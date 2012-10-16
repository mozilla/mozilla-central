/* -*- Mode: C++; tab-width: 4; indent-tabs-mode: nil; c-basic-offset: 4 -*- */
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

#include "msgCore.h"    // precompiled header...
#include "prlog.h"

#include "MailNewsTypes.h"
#include "nsMsgKeySet.h"
#include "prprf.h"
#include "prmem.h"
#include "nsTArray.h"
#include "nsMemory.h"
#include <ctype.h>

#if defined(DEBUG_seth_) || defined(DEBUG_sspitzer_)
#define DEBUG_MSGKEYSET 1
#endif

/* A compressed encoding for sets of article.  This is usually for lines from
   the newsrc, which have article lists like

   1-29627,29635,29658,32861-32863

   so the data has these properties:

   - strictly increasing
   - large subsequences of monotonically increasing ranges
   - gaps in the set are usually small, but not always
   - consecutive ranges tend to be large

   The biggest win is to run-length encode the data, storing ranges as two
   numbers (start+length or start,end). We could also store each number as a
   delta from the previous number for further compression, but that gets kind
   of tricky, since there are no guarentees about the sizes of the gaps, and
   we'd have to store variable-length words.

   Current data format:

   DATA := SIZE [ CHUNK ]*
   CHUNK := [ RANGE | VALUE ]
   RANGE := -LENGTH START
   START := VALUE
   LENGTH := int32_t
   VALUE := a literal positive integer, for now
   it could also be an offset from the previous value.
   LENGTH could also perhaps be a less-than-32-bit quantity,
   at least most of the time.

   Lengths of CHUNKs are stored negative to distinguish the beginning of
   a chunk from a literal: negative means two-word sequence, positive
   means one-word sequence.

   0 represents a literal 0, but should not occur, and should never occur
   except in the first position.

   A length of -1 won't occur either, except temporarily - a sequence of
   two elements is represented as two literals, since they take up the same
   space.

   Another optimization we make is to notice that we typically ask the
   question ``is N a member of the set'' for increasing values of N. So the
   set holds a cache of the last value asked for, and can simply resume the
   search from there.  */

nsMsgKeySet::nsMsgKeySet(/* MSG_NewsHost* host*/)
{
  MOZ_COUNT_CTOR(nsMsgKeySet);
  m_cached_value = -1;
  m_cached_value_index = 0;
  m_length = 0;
  m_data_size = 10;
  m_data = (int32_t *) PR_Malloc (sizeof (int32_t) * m_data_size);
#ifdef NEWSRC_DOES_HOST_STUFF
  m_host = host;
#endif
}


nsMsgKeySet::~nsMsgKeySet()
{
  MOZ_COUNT_DTOR(nsMsgKeySet);
  PR_FREEIF(m_data);
}


bool nsMsgKeySet::Grow()
{
  int32_t new_size;
  int32_t *new_data;
  new_size = m_data_size * 2;
  new_data = (int32_t *) PR_REALLOC (m_data, sizeof (int32_t) * new_size);
  if (! new_data)
    return false;
  m_data_size = new_size;
  m_data = new_data;
  return true;
}


nsMsgKeySet::nsMsgKeySet(const char* numbers /* , MSG_NewsHost* host */)
{
  int32_t *head, *tail, *end;
    MOZ_COUNT_CTOR(nsMsgKeySet);

#ifdef NEWSRC_DOES_HOST_STUFF
  m_host = host;
#endif
  m_cached_value = -1;
  m_cached_value_index = 0;
  m_length = 0;
  m_data_size = 10;
  m_data = (int32_t *) PR_Malloc (sizeof (int32_t) * m_data_size);
  if (!m_data) return;

  head = m_data;
  tail = head;
  end = head + m_data_size;

  if(!numbers) {
    return;
  }

  while (isspace (*numbers)) numbers++;
  while (*numbers) {
    int32_t from = 0;
    int32_t to;

    if (tail >= end - 4) {
      /* out of room! */
      int32_t tailo = tail - head;
      if (!Grow()) {
        PR_FREEIF(m_data);
        return;
      }
      /* data may have been relocated */
      head = m_data;
      tail = head + tailo;
      end = head + m_data_size;
    }

    while (isspace(*numbers)) numbers++;
    if (*numbers && !isdigit(*numbers)) {
      break;      /* illegal character */
    }
    while (isdigit (*numbers)) {
      from = (from * 10) + (*numbers++ - '0');
    }
    while (isspace(*numbers)) numbers++;
    if (*numbers != '-') {
      to = from;
    } else {
      to = 0;
      numbers++;
      while (*numbers >= '0' && *numbers <= '9')
        to = (to * 10) + (*numbers++ - '0');
      while (isspace(*numbers)) numbers++;
    }

    if (to < from) to = from; /* illegal */

    /* This is a hack - if the newsrc file specifies a range 1-x as
       being read, we internally pretend that article 0 is read as well.
       (But if only 2-x are read, then 0 is not read.)  This is needed
       because some servers think that article 0 is an article (I think)
       but some news readers (including Netscape 1.1) choke if the .newsrc
       file has lines beginning with 0...   ### */
    if (from == 1) from = 0;

    if (to == from) {
      /* Write it as a literal */
      *tail = from;
      tail++;
    } else /* Write it as a range. */ {
      *tail = -(to - from);
      tail++;
      *tail = from;
      tail++;
    }

    while (*numbers == ',' || isspace(*numbers)) {
      numbers++;
    }
  }

  m_length = tail - head; /* size of data */
}



nsMsgKeySet*
nsMsgKeySet::Create(/*MSG_NewsHost* host*/)
{
  nsMsgKeySet* set = new nsMsgKeySet(/* host */);
  if (set && set->m_data == NULL) {
    delete set;
    set = NULL;
  }
  return set;
}


nsMsgKeySet*
nsMsgKeySet::Create(const char* value /* , MSG_NewsHost* host */)
{
#ifdef DEBUG_MSGKEYSET
    printf("create from %s\n",value);
#endif

  nsMsgKeySet* set = new nsMsgKeySet(value /* , host */);
  if (set && set->m_data == NULL) {
    delete set;
    set = NULL;
  }
  return set;
}



/* Returns the lowest non-member of the set greater than 0.
 */
int32_t
nsMsgKeySet::FirstNonMember ()
{
  if (m_length <= 0) {
    return 1;
  } else if(m_data[0] < 0 && m_data[1] != 1 && m_data[1] != 0) {
    /* first range not equal to 0 or 1, always return 1 */
    return 1;
  } else if (m_data[0] < 0) {
    /* it's a range */
    /* If there is a range [N-M] we can presume that M+1 is not in the
       set. */
    return (m_data[1] - m_data[0] + 1);
  } else {
    /* it's a literal */
    if (m_data[0] == 1) {
      /* handle "1,..." */
      if (m_length > 1 && m_data[1] == 2) {
        /* This is "1,2,M-N,..." or "1,2,M,..."  where M >= 4.  Note
           that M will never be 3, because in that case we would have
           started with a range: "1-3,..." */
        return 3;
      } else {
        return 2;              /* handle "1,M-N,.." or "1,M,..."
                      where M >= 3; */
      }
    }
    else if (m_data[0] == 0) {
      /* handle "0,..." */
      if (m_length > 1 && m_data[1] == 1) {
        /* this is 0,1, (see above) */
        return 2;
      }
      else {
        return 1;
      }

    } else {
      /* handle "M,..." where M >= 2. */
      return 1;
    }
  }
}


nsresult 
nsMsgKeySet::Output(char **outputStr)
{
  NS_ENSURE_ARG(outputStr);
  int32_t size;
  int32_t *head;
  int32_t *tail;
  int32_t *end;
  int32_t s_size;
  char *s_head;
  char *s, *s_end;
  int32_t last_art = -1;

  *outputStr = nullptr;

  size = m_length;
  head = m_data;
  tail = head;
  end = head + size;

  s_size = (size * 12) + 10;  // dmb - try to make this allocation get used at least once.
  s_head = (char *) nsMemory::Alloc(s_size);
  if (! s_head) return NS_ERROR_OUT_OF_MEMORY;

  s_head[0] = '\0';      // otherwise, s_head will contain garbage.
  s = s_head;
  s_end = s + s_size;

  while (tail < end) {
    int32_t from;
    int32_t to;

    if (s > (s_end - (12 * 2 + 10))) { /* 12 bytes for each number (enough
                        for "2147483647" aka 2^31-1),
                        plus 10 bytes of slop. */
      int32_t so = s - s_head;
      s_size += 200;
      char* tmp = (char *) nsMemory::Alloc(s_size);
      if (tmp) PL_strcpy(tmp, s_head);
      nsMemory::Free(s_head);
      s_head = tmp;
      if (!s_head) return NS_ERROR_OUT_OF_MEMORY;
      s = s_head + so;
      s_end = s_head + s_size;
    }

    if (*tail < 0) {
      /* it's a range */
      from = tail[1];
      to = from + (-(tail[0]));
      tail += 2;
    }
    else /* it's a literal */
      {
        from = *tail;
        to = from;
        tail++;
      }
    if (from == 0) {
      from = 1;        /* See 'hack' comment above  ### */
    }
    if (from <= last_art) from = last_art + 1;
    if (from <= to) {
      if (from < to) {
        PR_snprintf(s, s_end - s, "%lu-%lu,", from, to);
      } else {
        PR_snprintf(s, s_end - s, "%lu,", from);
      }
      s += PL_strlen(s);
      last_art = to;
    }
  }
  if (last_art >= 0) {
    s--;              /* Strip off the last ',' */
  }

  *s = 0;

  *outputStr = s_head;
  return NS_OK;
}

int32_t 
nsMsgKeySet::GetLastMember()
{
  if (m_length > 1)
  {
    int32_t nextToLast = m_data[m_length - 2];
    if (nextToLast < 0)  // is range at end?
    {
      int32_t last = m_data[m_length - 1];
      return (-nextToLast + last - 1);
    }
    else  // no, so last number must be last member
    {
      return m_data[m_length - 1];
    }
  }
  else if (m_length == 1)
    return m_data[0];  // must be only 1 read.
  else
    return 0;
}

void nsMsgKeySet::SetLastMember(int32_t newHighWaterMark)
{
  if (newHighWaterMark < GetLastMember())
  {
    while (true)
    {
      if (m_length > 1)
      {
        int32_t nextToLast = m_data[m_length - 2];
        int32_t curHighWater;
        if (nextToLast < 0)  // is range at end?
        {
          int32_t rangeStart = m_data[m_length - 1];
          int32_t rangeLength = -nextToLast;
          curHighWater = (rangeLength + rangeStart - 1);
          if (curHighWater > newHighWaterMark)
          {
            if (rangeStart > newHighWaterMark)  
            {
              m_length -= 2;  // throw away whole range
            }
            else if (rangeStart == newHighWaterMark)
            {
              // turn range into single element.
              m_data[m_length - 2] = newHighWaterMark;
              m_length--;
              break;
            }
            else  // just shorten range
            {
              m_data[m_length - 2] = -(newHighWaterMark - rangeStart);
              break;
            }
          }
          else {
            // prevent the infinite loop
            // see bug #13062
            break;
          }  
        }
        else if (m_data[m_length - 1] > newHighWaterMark)  // no, so last number must be last member
        {
          m_length--;
        }
        else
          break;
      }
      else 
        break;
    }
    // well, the whole range is probably invalid, because the server probably re-ordered ids, 
    // but what can you do?
#ifdef NEWSRC_DOES_HOST_STUFF
    if (m_host) 
      m_host->MarkDirty();
#endif
  }
}

int32_t 
nsMsgKeySet::GetFirstMember()
{
  if (m_length > 1)
  {
    int32_t first = m_data[0];
    if (first < 0)  // is range at start?
    {
      int32_t second = m_data[1];
      return (second);
    }
    else  // no, so first number must be first member
    {
      return m_data[0];
    }
  }
  else if (m_length == 1)
    return m_data[0];  // must be only 1 read.
  else
    return 0;
}

/* Re-compresses a `nsMsgKeySet' object.

   The assumption is made that the `nsMsgKeySet' is syntactically correct
   (all ranges have a length of at least 1, and all values are non-
   decreasing) but will optimize the compression, for example, merging
   consecutive literals or ranges into one range.

   Returns true if successful, false if there wasn't enough memory to
   allocate scratch space.

   #### This should be changed to modify the buffer in place.

   Also note that we never call Optimize() unless we actually changed
   something, so it's a great place to tell the MSG_NewsHost* that something
   changed.
   */
bool
nsMsgKeySet::Optimize()
{
  int32_t input_size;
  int32_t output_size;
  int32_t *input_tail;
  int32_t *output_data;
  int32_t *output_tail;
  int32_t *input_end;
  int32_t *output_end;

  input_size = m_length;
  output_size = input_size + 1;
  input_tail = m_data;
  output_data = (int32_t *) PR_Malloc (sizeof (int32_t) * output_size);
  if (!output_data) return false;

  output_tail = output_data;
  input_end = input_tail + input_size;
  output_end = output_data + output_size;

  /* We're going to modify the set, so invalidate the cache. */
  m_cached_value = -1;

  while (input_tail < input_end) {
    int32_t from, to;
    bool range_p = (*input_tail < 0);

    if (range_p) {
      /* it's a range */
      from = input_tail[1];
      to = from + (-(input_tail[0]));

      /* Copy it over */
      *output_tail++ = *input_tail++;
      *output_tail++ = *input_tail++;        
    } else {
      /* it's a literal */
      from = *input_tail;
      to = from;

      /* Copy it over */
      *output_tail++ = *input_tail++;
    }
    NS_ASSERTION(output_tail < output_end, "invalid end of output string");
    if (output_tail >= output_end) {
      PR_Free(output_data);
      return false;
    }

    /* As long as this chunk is followed by consecutive chunks,
       keep extending it. */
    while (input_tail < input_end &&
         ((*input_tail > 0 && /* literal... */
         *input_tail == to + 1) || /* ...and consecutive, or */
        (*input_tail <= 0 && /* range... */
         input_tail[1] == to + 1)) /* ...and consecutive. */
         ) {
      if (! range_p) {
        /* convert the literal to a range. */
        output_tail++;
        output_tail [-2] = 0;
        output_tail [-1] = from;
        range_p = true;
      }

      if (*input_tail > 0) { /* literal */
        output_tail[-2]--; /* increase length by 1 */
        to++;
        input_tail++;
      } else {
        int32_t L2 = (- *input_tail) + 1;
        output_tail[-2] -= L2; /* increase length by N */
        to += L2;
        input_tail += 2;
      }
    }
  }

  PR_Free (m_data);
  m_data = output_data;
  m_data_size = output_size;
  m_length = output_tail - output_data;

  /* One last pass to turn [N - N+1] into [N, N+1]. */
  output_tail = output_data;
  output_end = output_tail + m_length;
  while (output_tail < output_end) {
    if (*output_tail < 0) {
      /* it's a range */
      if (output_tail[0] == -1) {
        output_tail[0] = output_tail[1];
        output_tail[1]++;
      }
      output_tail += 2;
    } else {
      /* it's a literal */
      output_tail++;
    }
  }

#ifdef NEWSRC_DOES_HOST_STUFF
  if (m_host) m_host->MarkDirty();
#endif
  return true;
}



bool
nsMsgKeySet::IsMember(int32_t number)
{
  bool value = false;
  int32_t size;
  int32_t *head;
  int32_t *tail;
  int32_t *end;

  size = m_length;
  head = m_data;
  tail = head;
  end = head + size;

  /* If there is a value cached, and that value is smaller than the
     value we're looking for, skip forward that far. */
  if (m_cached_value > 0 &&
    m_cached_value < number) {
    tail += m_cached_value_index;
  }

  while (tail < end) {
    if (*tail < 0) {
      /* it's a range */
      int32_t from = tail[1];
      int32_t to = from + (-(tail[0]));
      if (from > number) {
        /* This range begins after the number - we've passed it. */
        value = false;
        goto DONE;
      } else if (to >= number) {
        /* In range. */
        value = true;
        goto DONE;
      } else {
        tail += 2;
      }
    }
    else {
      /* it's a literal */
      if (*tail == number) {
        /* bang */
        value = true;
        goto DONE;
      } else if (*tail > number) {
        /* This literal is after the number - we've passed it. */
        value = false;
        goto DONE;
      } else {
        tail++;
      }
    }
  }

DONE:
  /* Store the position of this chunk for next time. */
  m_cached_value = number;
  m_cached_value_index = tail - head;

  return value;
}


int
nsMsgKeySet::Add(int32_t number)
{
  int32_t size;
  int32_t *head;
  int32_t *tail;
  int32_t *end;

#ifdef DEBUG_MSGKEYSET
    printf("add %d\n",number);
#endif
    
  size = m_length;
  head = m_data;
  tail = head;
  end = head + size;

  NS_ASSERTION (number >= 0, "can't have negative items");
  if (number < 0)
    return 0;

  /* We're going to modify the set, so invalidate the cache. */
  m_cached_value = -1;

  while (tail < end) {
    if (*tail < 0) {
      /* it's a range */
      int32_t from = tail[1];
      int32_t to = from + (-(tail[0]));

      if (from <= number && to >= number) {
        /* This number is already present - we don't need to do
           anything. */
        return 0;
      }

      if (to > number) {
        /* We have found the point before which the new number
           should be inserted. */
        break;
      }

      tail += 2;
    } else {
      /* it's a literal */
      if (*tail == number) {
        /* This number is already present - we don't need to do
           anything. */
        return 0;
      }

      if (*tail > number) {
        /* We have found the point before which the new number
           should be inserted. */
        break;
      }

      tail++;
    }
  }

  /* At this point, `tail' points to a position in the set which represents
     a value greater than `new'; or it is at `end'. In the interest of
     avoiding massive duplication of code, simply insert a literal here and
     then run the optimizer.
     */
  int mid = (tail - head); 

  if (m_data_size <= m_length + 1) {
    int endo = end - head;
    if (!Grow()) {
      // out of memory
      return -1;
    }
    head = m_data;
    end = head + endo;
  }

  if (tail == end) {
    /* at the end */
    /* Add a literal to the end. */
    m_data[m_length++] = number;
  } else {
    /* need to insert (or edit) in the middle */
    int32_t i;
    for (i = size; i > mid; i--) {
      m_data[i] = m_data[i-1];
    }
    m_data[i] = number;
    m_length++;
  }

  Optimize();
  return 1;
}



int
nsMsgKeySet::Remove(int32_t number)
{
  int32_t size;
  int32_t *head;
  int32_t *tail;
  int32_t *end;
#ifdef DEBUG_MSGKEYSET
    printf("remove %d\n",number);
#endif

  size = m_length;
  head = m_data;
  tail = head;
  end = head + size;

  // **** I am not sure this is a right thing to comment the following
  // statements out. The reason for this is due to the implementation of
  // offline save draft and template. We use faked UIDs (negative ids) for
  // offline draft and template in order to distinguish them from real
  // UID. David I need your help here. **** jt

  // PR_ASSERT(number >= 0);
  // if (number < 0) {
  //  return -1;
  /// }

  /* We're going to modify the set, so invalidate the cache. */
  m_cached_value = -1;

  while (tail < end) {
    int32_t mid = (tail - m_data);

    if (*tail < 0) {
      /* it's a range */
      int32_t from = tail[1];
      int32_t to = from + (-(tail[0]));

      if (number < from || number > to) {
        /* Not this range */
        tail += 2;
        continue;
      }

      if (to == from + 1) {
        /* If this is a range [N - N+1] and we are removing M
           (which must be either N or N+1) replace it with a
           literal. This reduces the length by 1. */
        m_data[mid] = (number == from ? to : from);
        while (++mid < m_length) {
          m_data[mid] = m_data[mid+1];
        }
        m_length--;
        Optimize();
        return 1;
      } else if (to == from + 2) {
        /* If this is a range [N - N+2] and we are removing M,
           replace it with the literals L,M (that is, either
           (N, N+1), (N, N+2), or (N+1, N+2). The overall
           length remains the same. */
        m_data[mid] = from;
        m_data[mid+1] = to;
        if (from == number) {
          m_data[mid] = from+1;
        } else if (to == number) {
          m_data[mid+1] = to-1;
        }
        Optimize();
        return 1;
      } else if (from == number) {
        /* This number is at the beginning of a long range (meaning a
           range which will still be long enough to remain a range.)
           Increase start and reduce length of the range. */
        m_data[mid]++;
        m_data[mid+1]++;
        Optimize();
        return 1;
      } else if (to == number) {
        /* This number is at the end of a long range (meaning a range
           which will still be long enough to remain a range.)
           Just decrease the length of the range. */
        m_data[mid]++;
        Optimize();
        return 1;
      } else {
        /* The number being deleted is in the middle of a range which
           must be split. This increases overall length by 2.
           */
        int32_t i;
        int endo = end - head;
        if (m_data_size - m_length <= 2) {
          if (!Grow())
            // out of memory
            return -1;
        }
        head = m_data;
        end = head + endo;

        for (i = m_length + 2; i > mid + 2; i--) {
          m_data[i] = m_data[i-2];
        }

        m_data[mid] = (- (number - from - 1));
        m_data[mid+1] = from;
        m_data[mid+2] = (- (to - number - 1));
        m_data[mid+3] = number + 1;
        m_length += 2;

        /* Oops, if we've ended up with a range with a 0 length,
           which is illegal, convert it to a literal, which reduces
           the overall length by 1. */
        if (m_data[mid] == 0) {
          /* first range */
          m_data[mid] = m_data[mid+1];
          for (i = mid + 1; i < m_length; i++) {
            m_data[i] = m_data[i+1];
          }
          m_length--;
        }
        if (m_data[mid+2] == 0) {
          /* second range */
          m_data[mid+2] = m_data[mid+3];
          for (i = mid + 3; i < m_length; i++) {
            m_data[i] = m_data[i+1];
          }
          m_length--;
        }
        Optimize();
        return 1;
      }
    } else {
      /* it's a literal */
      if (*tail != number) {
        /* Not this literal */
        tail++;
        continue;
      }

      /* Excise this literal. */
      m_length--;
      while (mid < m_length) {
        m_data[mid] = m_data[mid+1];
        mid++;
      }
      Optimize();
      return 1;
    }
  }

  /* It wasn't here at all. */
  return 0;
}


static int32_t*
msg_emit_range(int32_t* tmp, int32_t a, int32_t b)
{
  if (a == b) {
    *tmp++ = a;
  } else {
    NS_ASSERTION(a < b && a >= 0, "range is out of order");
    *tmp++ = -(b - a);
    *tmp++ = a;
  }
  return tmp;
}


int
nsMsgKeySet::AddRange(int32_t start, int32_t end)
{
  int32_t tmplength;
  int32_t* tmp;
  int32_t* in;
  int32_t* out;
  int32_t* tail;
  int32_t a;
  int32_t b;
  bool didit = false;

  /* We're going to modify the set, so invalidate the cache. */
  m_cached_value = -1;

  NS_ASSERTION(start <= end, "invalid range");
  if (start > end) return -1;

  if (start == end) {
    return Add(start);
  }

  tmplength = m_length + 2;
  tmp = (int32_t*) PR_Malloc(sizeof(int32_t) * tmplength);

  if (!tmp)
    // out of memory
    return -1;

  in = m_data;
  out = tmp;
  tail = in + m_length;

#define EMIT(x, y) out = msg_emit_range(out, x, y)

  while (in < tail) {
    // Set [a,b] to be this range.
    if (*in < 0) {
      b = - *in++;
      a = *in++;
      b += a;
    } else {
      a = b = *in++;
    }

    if (a <= start && b >= end) {
      // We already have the entire range marked.
      PR_Free(tmp);
      return 0;
    }
    if (start > b + 1) {
      // No overlap yet.
      EMIT(a, b);
    } else if (end < a - 1) {
      // No overlap, and we passed it.
      EMIT(start, end);
      EMIT(a, b);
      didit = true;
      break;
    } else {
      // The ranges overlap.  Suck this range into our new range, and
      // keep looking for other ranges that might overlap.
      start = start < a ? start : a;
      end = end > b ? end : b;
    }
  }
  if (!didit) EMIT(start, end);
  while (in < tail) {
    *out++ = *in++;
  }

#undef EMIT

  PR_Free(m_data);
  m_data = tmp;
  m_length = out - tmp;
  m_data_size = tmplength;
#ifdef NEWSRC_DOES_HOST_STUFF
  if (m_host) m_host->MarkDirty();
#endif
  return 1;
}

int32_t
nsMsgKeySet::CountMissingInRange(int32_t range_start, int32_t range_end)
{
  int32_t count;
  int32_t *head;
  int32_t *tail;
  int32_t *end;

  NS_ASSERTION (range_start >= 0 && range_end >= 0 && range_end >= range_start, "invalid range");
  if (range_start < 0 || range_end < 0 || range_end < range_start) return -1;

  head = m_data;
  tail = head;
  end = head + m_length;

  count = range_end - range_start + 1;

  while (tail < end) {
    if (*tail < 0) {
      /* it's a range */
      int32_t from = tail[1];
      int32_t to = from + (-(tail[0]));
      if (from < range_start) from = range_start;
      if (to > range_end) to = range_end;

      if (to >= from)
        count -= (to - from + 1);

      tail += 2;
    } else {
      /* it's a literal */
      if (*tail >= range_start && *tail <= range_end) count--;
      tail++;
    }
    NS_ASSERTION (count >= 0, "invalid count");
  }
  return count;
}


int 
nsMsgKeySet::FirstMissingRange(int32_t min, int32_t max,
                  int32_t* first, int32_t* last)
{
  int32_t size;
  int32_t *head;
  int32_t *tail;
  int32_t *end;
  int32_t from = 0;
  int32_t to = 0;
  int32_t a;
  int32_t b;

  NS_ASSERTION(first && last, "invalid parameter");
  if (!first || !last) return -1;

  *first = *last = 0;

  NS_ASSERTION(min <= max && min > 0, "invalid min or max param");
  if (min > max || min <= 0) return -1;

  size = m_length;
  head = m_data;
  tail = head;
  end = head + size;

  while (tail < end) {
    a = to + 1;
    if (*tail < 0) {      /* We got a range. */
      from = tail[1];
      to = from + (-(tail[0]));
      tail += 2;
    } else {
      from = to = tail[0];
      tail++;
    }
    b = from - 1;
    /* At this point, [a,b] is the range of unread articles just before
       the current range of read articles [from,to].  See if this range
       intersects the [min,max] range we were given. */
    if (a > max) return 0;  /* It's hopeless; there are none. */
    if (a <= b && b >= min) {
      /* Ah-hah!  We found an intersection. */
      *first = a > min ? a : min;
      *last = b < max ? b : max;
      return 0;
    }
  } 
  /* We found no holes in the newsrc that overlaps the range, nor did we hit
     something read beyond the end of the range.  So, the great infinite
     range of unread articles at the end of any newsrc line intersects the
     range we want, and we just need to return that. */
  a = to + 1;
  *first = a > min ? a : min;
  *last = max;
  return 0;
}

// I'm guessing we didn't include this because we didn't think we're going
// to need it. I'm not so sure. I'm putting it in for now.
int 
nsMsgKeySet::LastMissingRange(int32_t min, int32_t max,
                  int32_t* first, int32_t* last)
{
  int32_t size;
  int32_t *head;
  int32_t *tail;
  int32_t *end;
  int32_t from = 0;
  int32_t to = 0;
  int32_t a;
  int32_t b;

  NS_ASSERTION(first && last, "invalid null param");
  if (!first || !last) return -1;

  *first = *last = 0;


  NS_ASSERTION(min <= max && min > 0, "invalid min or max");
  if (min > max || min <= 0) return -1;

  size = m_length;
  head = m_data;
  tail = head;
  end = head + size;

  while (tail < end) {
  a = to + 1;
  if (*tail < 0) {      /* We got a range. */
    from = tail[1];
    to = from + (-(tail[0]));
    tail += 2;
  } else {
    from = to = tail[0];
    tail++;
  }
  b = from - 1;
  /* At this point, [a,b] is the range of unread articles just before
     the current range of read articles [from,to].  See if this range
     intersects the [min,max] range we were given. */
  if (a > max) return 0;  /* We're done.  If we found something, it's already
                 sitting in [*first,*last]. */
  if (a <= b && b >= min) {
    /* Ah-hah!  We found an intersection. */
    *first = a > min ? a : min;
    *last = b < max ? b : max;
    /* Continue on, looking for a later range. */
  }
  }
  if (to < max) {
  /* The great infinite range of unread articles at the end of any newsrc
     line intersects the range we want, and we just need to return that. */
  a = to + 1;
  *first = a > min ? a : min;
  *last = max;
  }
  return 0;
}

/**
 * Fill the passed in aArray with the keys in the message key set.
 */
nsresult
nsMsgKeySet::ToMsgKeyArray(nsTArray<nsMsgKey> &aArray)
{
    int32_t size;
    int32_t *head;
    int32_t *tail;
    int32_t *end;
    int32_t last_art = -1;

    size = m_length;
    head = m_data;
    tail = head;
    end = head + size;

    while (tail < end) {
        int32_t from;
        int32_t to;

        if (*tail < 0) {
            /* it's a range */
            from = tail[1];
            to = from + (-(tail[0]));
            tail += 2;
        }
        else /* it's a literal */
            {
                from = *tail;
                to = from;
                tail++;
            }
        // The horrible news-hack used to adjust from to 1 if it was zero right
        // here, but there is no longer a consumer of this method with that
        // broken use-case.
        if (from <= last_art) from = last_art + 1;
        if (from <= to) {
            if (from < to) {
                for (int32_t i = from; i <= to ; ++i ) {
                    aArray.AppendElement(i);
                }
            } else {
                aArray.AppendElement(from);
            }
            last_art = to;
        }
    }

    return NS_OK;
}


#ifdef DEBUG /* A lot of test cases for the above */

#define countof(x) (sizeof(x) / sizeof(*(x)))

void
nsMsgKeySet::test_decoder (const char *string)
{
  nsMsgKeySet set(string /* , NULL */);
  char* tmp;
  set.Output(&tmp);
  printf ("\t\"%s\"\t--> \"%s\"\n", string, tmp);
  nsMemory::Free(tmp);
}


#define START(STRING) \
  string = STRING;    \
  if (!(set = nsMsgKeySet::Create(string))) abort ()

#define FROB(N,PUSHP)                  \
  i = N;                        \
  if (!(NS_SUCCEEDED(set->Output(&s)))) abort ();          \
  printf ("%3lu: %-58s %c %3lu =\n", (unsigned long)set->m_length, s,  \
      (PUSHP ? '+' : '-'), (unsigned long)i);            \
  nsMemory::Free(s);                      \
  if (PUSHP                        \
    ? set->Add(i) < 0                  \
    : set->Remove(i) < 0)                \
  abort ();                      \
  if (!(NS_SUCCEEDED(set->Output(&s)))) abort ();          \
  printf ("%3lu: %-58s optimized =\n", (unsigned long)set->m_length, s);  \
  nsMemory::Free(s);                      \

#define END()                 \
  if (!(NS_SUCCEEDED(set->Output(&s)))) abort ();          \
  printf ("%3lu: %s\n\n", (unsigned long)set->m_length, s); \
  nsMemory::Free(s);                      \
  delete set;                 \



void
nsMsgKeySet::test_adder (void)
{
  const char *string;
  nsMsgKeySet *set;
  char *s;
  int32_t i;

  START("0-70,72-99,105,107,110-111,117-200");

  FROB(205, true);
  FROB(206, true);
  FROB(207, true);
  FROB(208, true);
  FROB(208, true);
  FROB(109, true);
  FROB(72, true);

  FROB(205, false);
  FROB(206, false);
  FROB(207, false);
  FROB(208, false);
  FROB(208, false);
  FROB(109, false);
  FROB(72, false);

  FROB(72, true);
  FROB(109, true);
  FROB(208, true);
  FROB(208, true);
  FROB(207, true);
  FROB(206, true);
  FROB(205, true);

  FROB(205, false);
  FROB(206, false);
  FROB(207, false);
  FROB(208, false);
  FROB(208, false);
  FROB(109, false);
  FROB(72, false);

  FROB(100, true);
  FROB(101, true);
  FROB(102, true);
  FROB(103, true);
  FROB(106, true);
  FROB(104, true);
  FROB(109, true);
  FROB(108, true);
  END();

  START("1-6"); FROB(7, false); END();
  START("1-6"); FROB(6, false); END();
  START("1-6"); FROB(5, false); END();
  START("1-6"); FROB(4, false); END();
  START("1-6"); FROB(3, false); END();
  START("1-6"); FROB(2, false); END();
  START("1-6"); FROB(1, false); END();
  START("1-6"); FROB(0, false); END();

  START("1-3"); FROB(1, false); END();
  START("1-3"); FROB(2, false); END();
  START("1-3"); FROB(3, false); END();

  START("1,3,5-7,9,10"); FROB(5, false); END();
  START("1,3,5-7,9,10"); FROB(6, false); END();
  START("1,3,5-7,9,10"); FROB(7, false); FROB(7, true); FROB(8, true);
  FROB (4, true); FROB (2, false); FROB (2, true);

  FROB (4, false); FROB (5, false); FROB (6, false); FROB (7, false);
  FROB (8, false); FROB (9, false); FROB (10, false); FROB (3, false);
  FROB (2, false); FROB (1, false); FROB (1, false); FROB (0, false);
  END();
}

#undef START
#undef FROB
#undef END



#define START(STRING) \
  string = STRING;    \
  if (!(set = nsMsgKeySet::Create(string))) abort ()

#define FROB(N,M)                        \
  i = N;                            \
  j = M;                            \
  if (!(NS_SUCCEEDED(set->Output(&s)))) abort ();          \
  printf ("%3lu: %-58s + %3lu-%3lu =\n", (unsigned long)set->m_length, s, (unsigned long)i, (unsigned long)j);  \
  nsMemory::Free(s);                      \
  switch (set->AddRange(i, j)) {                \
  case 0:                            \
  printf("(no-op)\n");                    \
  break;                            \
  case 1:                            \
  break;                            \
  default:                            \
  abort();                          \
  }                                \
  if (!(NS_SUCCEEDED(set->Output(&s)))) abort ();          \
  printf ("%3lu: %-58s\n", (unsigned long)set->m_length, s);            \
  nsMemory::Free(s);                      \


#define END()                 \
  if (!(NS_SUCCEEDED(set->Output(&s)))) abort ();          \
  printf ("%3lu: %s\n\n", (unsigned long)set->m_length, s); \
  nsMemory::Free(s);                      \
  delete set;


void
nsMsgKeySet::test_ranges(void)
{
  const char *string;
  nsMsgKeySet *set;
  char *s;
  int32_t i;
  int32_t j;

  START("20-40,72-99,105,107,110-111,117-200");

  FROB(205, 208);
  FROB(50, 70);
  FROB(0, 10);
  FROB(112, 113);
  FROB(101, 101);
  FROB(5, 75);
  FROB(103, 109);
  FROB(2, 20);
  FROB(1, 9999);

  END();


#undef START
#undef FROB
#undef END
}




#define TEST(N)                    \
  if (! with_cache) set->m_cached_value = -1;    \
  if (!(NS_SUCCEEDED(set->Output(&s)))) abort ();          \
  printf (" %3d = %s\n", N,              \
      (set->IsMember(N) ? "true" : "false")); \
  nsMemory::Free(s);

void
nsMsgKeySet::test_member(bool with_cache)
{
  nsMsgKeySet *set;
  char *s;

  s = "1-70,72-99,105,107,110-111,117-200";
  printf ("\n\nTesting %s (with%s cache)\n", s, with_cache ? "" : "out");
  if (!(set = Create(s))) {
  abort ();
  }

  TEST(-1);
  TEST(0);
  TEST(1);
  TEST(20);
  
  delete set;
  s = "0-70,72-99,105,107,110-111,117-200";
  printf ("\n\nTesting %s (with%s cache)\n", s, with_cache ? "" : "out");
  if (!(set = Create(s))) {
  abort ();
  }
  
  TEST(-1);
  TEST(0);
  TEST(1);
  TEST(20);
  TEST(69);
  TEST(70);
  TEST(71);
  TEST(72);
  TEST(73);
  TEST(74);
  TEST(104);
  TEST(105);
  TEST(106);
  TEST(107);
  TEST(108);
  TEST(109);
  TEST(110);
  TEST(111);
  TEST(112);
  TEST(116);
  TEST(117);
  TEST(118);
  TEST(119);
  TEST(200);
  TEST(201);
  TEST(65535);

  delete set;
}

#undef TEST


// static void
// test_newsrc (char *file)
// {
//   FILE *fp = fopen (file, "r");
//   char buf [1024];
//   if (! fp) abort ();
//   while (fgets (buf, sizeof (buf), fp))
//   {
//     if (!strncmp (buf, "options ", 8))
//     fwrite (buf, 1, strlen (buf), stdout);
//     else
//     {
//       char *sep = buf;
//       while (*sep != 0 && *sep != ':' && *sep != '!')
//       sep++;
//       if (*sep) sep++;
//       while (isspace (*sep)) sep++;
//       fwrite (buf, 1, sep - buf, stdout);
//       if (*sep)
//       {
//         char *s;
//         msg_NewsRCSet *set = msg_parse_newsrc_set (sep, &allocinfo);
//         if (! set)
//         abort ();
//         if (! msg_OptimizeNewsRCSet (set))
//         abort ();
//         if (! ((s = msg_format_newsrc_set (set))))
//         abort ();
//         msg_free_newsrc_set (set, &allocinfo);
//         fwrite (s, 1, strlen (s), stdout);
//         free (s);
//         fwrite ("\n", 1, 1, stdout);
//       }
//     }
//   }
//   fclose (fp);
// }

void
nsMsgKeySet::RunTests ()
{

  test_decoder ("");
  test_decoder (" ");
  test_decoder ("0");
  test_decoder ("1");
  test_decoder ("123");
  test_decoder (" 123 ");
  test_decoder (" 123 4");
  test_decoder (" 1,2, 3, 4");
  test_decoder ("0-70,72-99,100,101");
  test_decoder (" 0-70 , 72 - 99 ,100,101 ");
  test_decoder ("0 - 268435455");
  /* This one overflows - we can't help it.
   test_decoder ("0 - 4294967295"); */

  test_adder ();

  test_ranges();

  test_member (false);
  test_member (true);

  // test_newsrc ("/u/montulli/.newsrc");
  /* test_newsrc ("/u/jwz/.newsrc");*/
}

#endif /* DEBUG */
