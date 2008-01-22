/*
 * Copyright (c) 1999 Apple Computer, Inc. All rights reserved.
 *
 * @APPLE_LICENSE_HEADER_START@
 * 
 * This file contains Original Code and/or Modifications of Original Code
 * as defined in and that are subject to the Apple Public Source License
 * Version 2.0 (the 'License'). You may not use this file except in
 * compliance with the License. Please obtain a copy of the License at
 * http://www.opensource.apple.com/apsl/ and read it before using this
 * file.
 * 
 * The Original Code and all software distributed under the License are
 * distributed on an 'AS IS' basis, WITHOUT WARRANTY OF ANY KIND, EITHER
 * EXPRESS OR IMPLIED, AND APPLE HEREBY DISCLAIMS ALL SUCH WARRANTIES,
 * INCLUDING WITHOUT LIMITATION, ANY WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE, QUIET ENJOYMENT OR NON-INFRINGEMENT.
 * Please see the License for the specific language governing rights and
 * limitations under the License.
 * 
 * @APPLE_LICENSE_HEADER_END@
 */
/*
 * The strip(1) and nmedit(l) program.  This understands only Mach-O format
 * files (with the restriction the symbol table is at the end of the file) and
 * fat files with Mach-O files in them.
 */
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <limits.h>
#include <ctype.h>
#include <libc.h>
#include <sys/types.h>
#include <sys/stat.h>
#include <mach-o/loader.h>
#include <mach-o/reloc.h>
#include <mach-o/nlist.h>
#include <mach-o/stab.h>
#include "stuff/breakout.h"
#include "stuff/allocate.h"
#include "stuff/errors.h"
#include "stuff/round.h"
#include "stuff/reloc.h"
#include "stuff/reloc.h"
#include "stuff/symbol_list.h"
#include "stuff/unix_standard_mode.h"

/* These are set from the command line arguments */
__private_extern__
char *progname = NULL;	/* name of the program for error messages (argv[0]) */
static char *output_file;/* name of the output file */
static char *sfile;	/* filename of global symbol names to keep */
static char *Rfile;	/* filename of global symbol names to remove */
static long Aflag;	/* save only absolute symbols with non-zero value and
			   .objc_class_name_* symbols */
static long aflag;	/* -a save all symbols, just regenerate symbol table */
static long iflag;	/* -i ignore symbols in -s file not in object */
#ifdef NMEDIT
static long pflag;	/* make all defined global symbols private extern */
#else /* !defined(NMEDIT) */
static char *dfile;	/* filename of filenames of debugger symbols to keep */
static long uflag;	/* save undefined symbols */
static long rflag;	/* save symbols referenced dynamically */
static long nflag;	/* save N_SECT global symbols */
static long Sflag;	/* -S strip only debugger symbols N_STAB */
static long xflag;	/* -x strip non-globals */
static long Xflag;	/* -X strip local symbols with 'L' names */
static long tflag;	/* -t strip local symbols except those in the text
			   section with names that don't begin with 'L' */
static long cflag;	/* -c strip section contents from dynamic libraries
			   files to create stub libraries */
static long no_uuid;	/* -no_uuid strip LC_UUID load commands */
static long no_code_signature;
			/* -no_code_signature strip LC_CODE_SIGNATURE cmds */
static long strip_all = 1;
/*
 * This is set on an object by object basis if the strip_all flag is still set
 * and the object is an executable that is for use with the dynamic linker.
 * This has the same effect as -r and -u.
 */
static enum bool default_dyld_executable = FALSE;
#endif /* NMEDIT */

/*
 * Data structures to perform selective stripping of symbol table entries.
 * save_symbols is the names of the symbols from the -s <file> argument.
 * remove_symbols is the names of the symbols from the -R <file> argument.
 */
static struct symbol_list *save_symbols = NULL;
static unsigned long nsave_symbols = 0;
static struct symbol_list *remove_symbols = NULL;
static unsigned long nremove_symbols = 0;

/*
 * saves points to an array of longs that is allocated.  This array is a map of
 * old symbol indexes to new symbol indexes.  The new symbol indexes are
 * plus 1 and zero value means that old symbol is not in the new symbol table.
 * ref_saves is used in the same way but for the reference table.
 * nmedits is an array and indexed by the symbol index the value indicates if
 * the symbol was edited and turned into a non-global.
 */
static long *saves = NULL;
#ifndef NMEDIT
static long *ref_saves = NULL;
#else
static enum bool *nmedits = NULL;
#endif

/*
 * These hold the new symbol and string table created by strip_symtab()
 * and the new counts of local, defined external and undefined symbols.
 */
static struct nlist *new_symbols = NULL;
static struct nlist_64 *new_symbols64 = NULL;
static unsigned long new_nsyms = 0;
static char *new_strings = NULL;
static unsigned long new_strsize = 0;
static unsigned long new_nlocalsym = 0;
static unsigned long new_nextdefsym = 0;
static unsigned long new_nundefsym = 0;

/*
 * These hold the new table of contents, reference table and module table for
 * dylibs.
 */
static struct dylib_table_of_contents *new_tocs = NULL;
static unsigned long new_ntoc = 0;
static struct dylib_reference *new_refs = NULL;
static unsigned long new_nextrefsyms = 0;
#ifdef NMEDIT
static struct dylib_module *new_mods = NULL;
static struct dylib_module_64 *new_mods64 = NULL;
static unsigned long new_nmodtab = 0;
#endif

#ifndef NMEDIT
/*
 * The list of file names to save debugging symbols from.
 */
static char **debug_filenames = NULL;
static long ndebug_filenames = 0;
struct undef_map {
    unsigned long index;
    struct nlist symbol;
};
struct undef_map64 {
    unsigned long index;
    struct nlist_64 symbol64;
};
static char *qsort_strings = NULL;
#endif /* !defined(NMEDIT) */


/* Internal routines */
static void usage(
    void);

static void strip_file(
    char *input_file,
    struct arch_flag *arch_flags,
    unsigned long narch_flags,
    enum bool all_archs);

static void strip_arch(
    struct arch *archs,
    unsigned long narchs,
    struct arch_flag *arch_flags,
    unsigned long narch_flags,
    enum bool all_archs);

static void strip_object(
    struct arch *arch,
    struct member *member,
    struct object *object);

static void check_object_relocs(
    struct arch *arch,
    struct member *member,
    struct object *object,
    char *segname,
    char *sectname,
    unsigned long long sectsize,
    char *contents,
    struct relocation_info *relocs,
    uint32_t nreloc,
    struct nlist *symbols,
    struct nlist_64 *symbols64,
    unsigned long nsyms,
    char *strings,
    long *missing_reloc_symbols,
    enum byte_sex host_byte_sex);

static void check_indirect_symtab(
    struct arch *arch,
    struct member *member,
    struct object *object,
    unsigned long nitems,
    unsigned long reserved1,
    unsigned long section_type,
    char *contents,
    struct nlist *symbols,
    struct nlist_64 *symbols64,
    unsigned long nsyms,
    char *strings,
    long *missing_reloc_symbols,
    enum byte_sex host_byte_sex);

#ifndef NMEDIT
static enum bool strip_symtab(
    struct arch *arch,
    struct member *member,
    struct object *object,
    struct nlist *symbols,
    struct nlist_64 *symbols64,
    unsigned long nsyms,
    char *strings,
    unsigned long strsize,
    struct dylib_table_of_contents *tocs,
    unsigned long ntoc,
    struct dylib_module *mods,
    struct dylib_module_64 *mods64,
    unsigned long nmodtab,
    struct dylib_reference *refs,
    unsigned long nextrefsyms,
    uint32_t *indirectsyms,
    unsigned long nindirectsyms);

static void strip_LC_UUID_commands(
    struct arch *arch,
    struct member *member,
    struct object *object);

#ifndef NMEDIT
static void strip_LC_CODE_SIGNATURE_commands(
    struct arch *arch,
    struct member *member,
    struct object *object);
#endif /* !(NMEDIT) */

static enum bool private_extern_reference_by_module(
    unsigned long symbol_index,
    struct dylib_reference *refs,
    unsigned long nextrefsyms);

static enum bool symbol_pointer_used(
    unsigned long symbol_index,
    uint32_t *indirectsyms,
    unsigned long nindirectsyms);

static int cmp_qsort_undef_map(
    const struct undef_map *sym1,
    const struct undef_map *sym2);

static int cmp_qsort_undef_map_64(
    const struct undef_map64 *sym1,
    const struct undef_map64 *sym2);
#endif /* !defined(NMEDIT) */

#ifdef NMEDIT
static enum bool edit_symtab(
    struct arch *arch,
    struct member *member,
    struct object *object,
    struct nlist *symbols,
    struct nlist_64 *symbols64,
    unsigned long nsyms,
    char *strings,
    unsigned long strsize,
    struct dylib_table_of_contents *tocs,
    unsigned long ntoc,
    struct dylib_module *mods,
    struct dylib_module_64 *mods64,
    unsigned long nmodtab,
    struct dylib_reference *refs,
    unsigned long nextrefsyms);
#endif /* NMEDIT */

#ifndef NMEDIT
static void setup_debug_filenames(
    char *dfile);

static int cmp_qsort_filename(
    const char **name1,
    const char **name2);

static int cmp_bsearch_filename(
    const char *name1,
    const char **name2);
#endif /* NMEDIT */

#ifdef NMEDIT
/*
 * This variable and routines are used for nmedit(1) only.
 */
static char *global_strings = NULL;

static int cmp_qsort_global(
    const struct nlist **sym1,
    const struct nlist **sym2);

static int cmp_qsort_global_64(
    const struct nlist_64 **sym1,
    const struct nlist_64 **sym2);

static int cmp_bsearch_global_stab(
    const char *name,
    const struct nlist **sym);

static int cmp_bsearch_global_stab_64(
    const char *name,
    const struct nlist_64 **sym);

static int cmp_bsearch_global(
    const char *name,
    const struct nlist **sym);

static int cmp_bsearch_global_64(
    const char *name,
    const struct nlist_64 **sym);
#endif /* NMEDIT */

int
main(
int argc,
char *argv[],
char *envp[])
{
    int i;
    unsigned long j, args_left, files_specified;
    struct arch_flag *arch_flags;
    unsigned long narch_flags;
    enum bool all_archs;
    struct symbol_list *sp;

	progname = argv[0];

	arch_flags = NULL;
	narch_flags = 0;
	all_archs = FALSE;

	files_specified = 0;
	args_left = 1;
	for (i = 1; i < argc; i++){
	    if(argv[i][0] == '-'){
		if(argv[i][1] == '\0'){
		    args_left = 0;
		    break;
		}
		if(strcmp(argv[i], "-o") == 0){
		    if(i + 1 >= argc)
			fatal("-o requires an argument");
		    if(output_file != NULL)
			fatal("only one -o option allowed");
		    output_file = argv[i + 1];
		    i++;
		}
		else if(strcmp(argv[i], "-s") == 0){
		    if(i + 1 >= argc)
			fatal("-s requires an argument");
		    if(sfile != NULL)
			fatal("only one -s option allowed");
		    sfile = argv[i + 1];
		    i++;
		}
		else if(strcmp(argv[i], "-R") == 0){
		    if(i + 1 >= argc)
			fatal("-R requires an argument");
		    if(Rfile != NULL)
			fatal("only one -R option allowed");
		    Rfile = argv[i + 1];
		    i++;
		}
#ifndef NMEDIT
		else if(strcmp(argv[i], "-d") == 0){
		    if(i + 1 >= argc)
			fatal("-d requires an argument");
		    if(dfile != NULL)
			fatal("only one -d option allowed");
		    dfile = argv[i + 1];
		    i++;
		}
		else if(strcmp(argv[i], "-no_uuid") == 0){
		    no_uuid = 1;
		}
		else if(strcmp(argv[i], "-no_code_signature") == 0){
		    no_code_signature = 1;
		}
#endif /* !defined(NMEDIT) */
		else if(strcmp(argv[i], "-arch") == 0){
		    if(i + 1 == argc){
			error("missing argument(s) to %s option", argv[i]);
			usage();
		    }
		    if(strcmp("all", argv[i+1]) == 0){
			all_archs = TRUE;
		    }
		    else{
			arch_flags = reallocate(arch_flags,
				(narch_flags + 1) * sizeof(struct arch_flag));
			if(get_arch_from_flag(argv[i+1],
					      arch_flags + narch_flags) == 0){
			    error("unknown architecture specification flag: "
				  "%s %s", argv[i], argv[i+1]);
			    arch_usage();
			    usage();
			}
			for(j = 0; j < narch_flags; j++){
			    if(arch_flags[j].cputype ==
				    arch_flags[narch_flags].cputype &&
			       (arch_flags[j].cpusubtype & ~CPU_SUBTYPE_MASK) ==
				    (arch_flags[narch_flags].cpusubtype &
				    ~CPU_SUBTYPE_MASK) &&
			       strcmp(arch_flags[j].name,
				    arch_flags[narch_flags].name) == 0)
				break;
			}
			if(j == narch_flags)
			    narch_flags++;
		    }
		    i++;
		}
		else{
		    for(j = 1; argv[i][j] != '\0'; j++){
			switch(argv[i][j]){
#ifdef NMEDIT
			case 'p':
			    pflag = 1;
			    break;
#else /* !defined(NMEDIT) */
			case 'S':
			    Sflag = 1;
			    strip_all = 0;
			    break;
			case 'X':
			    Xflag = 1;
			    strip_all = 0;
			    break;
			case 'x':
			    xflag = 1;
			    strip_all = 0;
			    break;
			case 't':
			    tflag = 1;
			    strip_all = 0;
			    break;
			case 'i':
			    iflag = 1;
			    break;
			case 'u':
			    uflag = 1;
			    strip_all = 0;
			    break;
			case 'r':
			    rflag = 1;
			    strip_all = 0;
			    break;
			case 'n':
			    nflag = 1;
			    strip_all = 0;
			    break;
#endif /* !defined(NMEDIT) */
			case 'A':
			    Aflag = 1;
#ifndef NMEDIT
			    strip_all = 0;
#endif /* !defined(NMEDIT) */
			    break;
#ifndef NMEDIT
			case 'a':
			    aflag = 1;
			    strip_all = 0;
			    break;
			case 'c':
			    cflag = 1;
			    strip_all = 0;
			    break;
#endif /* NMEDIT */
			default:
			    error("unrecognized option: %s", argv[i]);
			    usage();
			}
		    }
		}
	    }
	    else
		files_specified++;
	}
	if(args_left == 0)
	    files_specified += argc - (i + 1);
	
	if(files_specified > 1 && output_file != NULL){
	    error("-o <filename> can only be used when one file is specified");
	    usage();
	}

	if(sfile){
	    setup_symbol_list(sfile, &save_symbols, &nsave_symbols);
	}
#ifdef NMEDIT
	else{
	    if(Rfile == NULL && pflag == 0){
		error("-s <filename>, -R <filename> or -p argument required");
		usage();
	    }
	}
#endif /* NMEDIT */

	if(Rfile){
	    setup_symbol_list(Rfile, &remove_symbols, &nremove_symbols);
	    if(sfile){
		for(j = 0; j < nremove_symbols ; j++){
		    sp = bsearch(remove_symbols[j].name,
				 save_symbols, nsave_symbols,
				 sizeof(struct symbol_list),
				 (int (*)(const void *, const void *))
				    symbol_list_bsearch);
		    if(sp != NULL){
			error("symbol name: %s is listed in both -s %s and -R "
			      "%s files (can't be both saved and removed)",
			      remove_symbols[j].name, sfile, Rfile);
		    }
		}
		if(errors)
		    exit(EXIT_FAILURE);
	    }
	}

	/* the default when no -arch flags is present is to strip all archs */
	if(narch_flags == 0)
	   all_archs = TRUE;

#ifndef NMEDIT
	if(dfile){
	    setup_debug_filenames(dfile);
	}
#endif /* !defined(NMEDIT) */

	files_specified = 0;
	args_left = 1;
	for (i = 1; i < argc; i++) {
	    if(args_left && argv[i][0] == '-'){
		if(argv[i][1] == '\0')
		    args_left = 0;
		else if(strcmp(argv[i], "-o") == 0 ||
			strcmp(argv[i], "-s") == 0 ||
			strcmp(argv[i], "-R") == 0 ||
#ifndef NMEDIT
			strcmp(argv[i], "-d") == 0 ||
#endif /* !defined(NMEDIT) */
			strcmp(argv[i], "-arch") == 0)
		    i++;
	    }
	    else{
		char resolved_path[PATH_MAX + 1];

		if(realpath(argv[i], resolved_path) == NULL)
		    strip_file(argv[i], arch_flags, narch_flags, all_archs);
		else
		    strip_file(resolved_path, arch_flags,narch_flags,all_archs);
		files_specified++;
	    }
	}
	if(files_specified == 0)
	    fatal("no files specified");

	if(errors)
	    return(EXIT_FAILURE);
	else
	    return(EXIT_SUCCESS);
}

static
void
usage(
void)
{
#ifndef NMEDIT
	fprintf(stderr, "Usage: %s [-AanuStXx] [-no_uuid] [-no_code_signature] "
		"[-] [-d filename] [-s filename] [-R filename] [-o output] "
		"file [...]\n", progname);
#else /* defined(NMEDIT) */
	fprintf(stderr, "Usage: %s -s filename [-R filename] [-p] [-A] [-] "
		"[-o output] file [...] \n",
		progname);
#endif /* NMEDIT */
	exit(EXIT_FAILURE);
}

static
void
strip_file(
char *input_file,
struct arch_flag *arch_flags,
unsigned long narch_flags,
enum bool all_archs)
{
    struct arch *archs;
    unsigned long narchs;
    struct stat stat_buf;
    unsigned long previous_errors;
    enum bool unix_standard_mode;
    int cwd_fd;
    char *rename_file;
#ifndef NMEDIT
    char *p;
#endif

	archs = NULL;
	narchs = 0;
	previous_errors = errors;
	errors = 0;

	/* breakout the file for processing */
	breakout(input_file, &archs, &narchs, FALSE);
	if(errors)
	    return;

	/* checkout the file for symbol table replacement processing */
	checkout(archs, narchs);

	/* process the symbols in the input file */
	strip_arch(archs, narchs, arch_flags, narch_flags, all_archs);
	if(errors)
	    return;

	/* create the output file */
	if(stat(input_file, &stat_buf) == -1)
	    system_error("can't stat input file: %s", input_file);
	if(output_file != NULL){
	    writeout(archs, narchs, output_file, stat_buf.st_mode & 0777,
		     TRUE, FALSE, FALSE, NULL);
	}
	else{
	    unix_standard_mode = get_unix_standard_mode();
	    rename_file = NULL;
	    cwd_fd = -1;
#ifdef NMEDIT
	    output_file = makestr(input_file, ".nmedit", NULL);
#else /* !defined(NMEDIT) */
	    /*
	     * In UNIX standard conformance mode we are not allowed to replace
	     * a file that is not writeable.
	     */
	    if(unix_standard_mode == TRUE && 
	       access(input_file, W_OK) == -1){
		system_error("file: %s is not writable", input_file);
		goto strip_file_return;
	    }
	    output_file = makestr(input_file, ".strip", NULL);

	    /*
	     * The UNIX standard conformance test suite expects files of
	     * MAXPATHLEN to work.
	     */
	    if(strlen(output_file) >= MAXPATHLEN){
		/*
		 * If there is a directory path in the name try to change
		 * the current working directory to that path.
		 */
		if((p = rindex(output_file, '/')) != NULL){
		    if((cwd_fd = open(".", O_RDONLY, 0)) == -1){
			system_error("can't open current working directory");
			goto strip_file_return;
		    }
		    *p = '\0';
		    if(chdir(output_file) == -1){
			system_error("can't change current working directory "
				     "to: %s", output_file);
			goto strip_file_return;
		    }
		    p = rindex(input_file, '/');
		    rename_file = makestr(p + 1, NULL);
		}
		/*
		 * Create what might be a short enough name.
		 */
		free(output_file);
		output_file = makestr("strip.XXXXXX", NULL);
		output_file = mktemp(output_file);
	    }
#endif /* NMEDIT */
	    writeout(archs, narchs, output_file, stat_buf.st_mode & 0777,
		     TRUE, FALSE, FALSE, NULL);
	    if(rename_file != NULL){
		if(rename(output_file, rename_file) == -1)
		    system_error("can't move temporary file: %s to file: %s",
				 output_file, rename_file);
		free(rename_file);
	    }
	    else{
		if(rename(output_file, input_file) == -1)
		    system_error("can't move temporary file: %s to input "
				 "file: %s", output_file, input_file);
	    }
	    free(output_file);
	    output_file = NULL;

	    /*
	     * If we changed the current working directory change back to
	     * the previous working directory.
	     */
	    if(cwd_fd != -1){
		if(fchdir(cwd_fd) == -1)
		    system_error("can't change back to previous working "
				 "directory");
		if(close(cwd_fd) == -1)
		    system_error("can't close previous working directory");
	    }
	}

#ifndef NMEDIT
strip_file_return:
#endif /* !defined(NMEDIT) */
	/* clean-up data structures */
	free_archs(archs, narchs);

	errors += previous_errors;
}

static
void
strip_arch(
struct arch *archs,
unsigned long narchs,
struct arch_flag *arch_flags,
unsigned long narch_flags,
enum bool all_archs)
{
    unsigned long i, j, k, offset, size, missing_syms;
    cpu_type_t cputype;
    cpu_subtype_t cpusubtype;
    struct arch_flag host_arch_flag;
    enum bool arch_process, any_processing, *arch_flag_processed, family;
    const struct arch_flag *family_arch_flag;

	/*
	 * Using the specified arch_flags process specified objects for those
	 * architecures.
	 */
	any_processing = FALSE;
	arch_flag_processed = NULL;
	if(narch_flags != 0)
	    arch_flag_processed = allocate(narch_flags * sizeof(enum bool));
	memset(arch_flag_processed, '\0', narch_flags * sizeof(enum bool));
	for(i = 0; i < narchs; i++){
	    /*
	     * Determine the architecture (cputype and cpusubtype) of arch[i]
	     */
	    cputype = 0;
	    cpusubtype = 0;
	    if(archs[i].type == OFILE_ARCHIVE){
		for(j = 0; j < archs[i].nmembers; j++){
		    if(archs[i].members[j].type == OFILE_Mach_O){
			cputype = archs[i].members[j].object->mh_cputype;
			cpusubtype = archs[i].members[j].object->mh_cpusubtype;
			break;
		    }
		}
	    }
	    else if(archs[i].type == OFILE_Mach_O){
		cputype = archs[i].object->mh_cputype;
		cpusubtype = archs[i].object->mh_cpusubtype;
	    }
	    else if(archs[i].fat_arch != NULL){
		cputype = archs[i].fat_arch->cputype;
		cpusubtype = archs[i].fat_arch->cpusubtype;
	    }
	    arch_process = FALSE;
	    if(all_archs == TRUE){
		arch_process = TRUE;
	    }
	    else if(narch_flags != 0){
		family = FALSE;
		if(narch_flags == 1){
		    family_arch_flag =
			get_arch_family_from_cputype(arch_flags[0].cputype);
		    if(family_arch_flag != NULL)
			family = (enum bool)
			  ((family_arch_flag->cpusubtype & ~CPU_SUBTYPE_MASK) ==
			   (arch_flags[0].cpusubtype & ~CPU_SUBTYPE_MASK));
		}
		for(j = 0; j < narch_flags; j++){
		    if(arch_flags[j].cputype == cputype &&
		       ((arch_flags[j].cpusubtype & ~CPU_SUBTYPE_MASK) ==
			(cpusubtype & ~CPU_SUBTYPE_MASK) ||
			family == TRUE)){
			arch_process = TRUE;
			arch_flag_processed[j] = TRUE;
			break;
		    }
		}
	    }
	    else{
		(void)get_arch_from_host(&host_arch_flag, NULL);
		if(host_arch_flag.cputype == cputype &&
		   (host_arch_flag.cpusubtype & ~CPU_SUBTYPE_MASK) ==
		   (cpusubtype & ~CPU_SUBTYPE_MASK))
		    arch_process = TRUE;
	    }
	    if(narchs != 1 && arch_process == FALSE)
		continue;
	    any_processing = TRUE;

	    /*
	     * Now this arch[i] has been selected to be processed so process it
	     * according to its type.
	     */
	    if(archs[i].type == OFILE_ARCHIVE){
		for(j = 0; j < archs[i].nmembers; j++){
		    if(archs[i].members[j].type == OFILE_Mach_O){
			strip_object(archs + i, archs[i].members + j,
				     archs[i].members[j].object);
		    }
		}
		missing_syms = 0;
		if(iflag == 0){
		    for(k = 0; k < nsave_symbols; k++){
			if(save_symbols[k].seen == FALSE){
			    if(missing_syms == 0){
				error_arch(archs + i, NULL, "symbols names "
					   "listed in: %s not in: ", sfile);
				missing_syms = 1;
			    }
			    fprintf(stderr, "%s\n", save_symbols[k].name);
			}
		    }
		}
		for(k = 0; k < nsave_symbols; k++){
		    save_symbols[k].seen = FALSE;
		}
		missing_syms = 0;
		if(iflag == 0){
		    for(k = 0; k < nremove_symbols; k++){
			if(remove_symbols[k].seen == FALSE){
			    if(missing_syms == 0){
				error_arch(archs + i, NULL, "symbols names "
					   "listed in: %s not defined in: ",
					   Rfile);
				missing_syms = 1;
			    }
			    fprintf(stderr, "%s\n", remove_symbols[k].name);
			}
		    }
		}
		for(k = 0; k < nremove_symbols; k++){
		    remove_symbols[k].seen = FALSE;
		}
		/*
		 * Reset the library offsets and size.
		 */
		offset = 0;
		for(j = 0; j < archs[i].nmembers; j++){
		    archs[i].members[j].offset = offset;
		    size = 0;
		    if(archs[i].members[j].member_long_name == TRUE){
			size = round(archs[i].members[j].member_name_size, 8) +
			       (round(sizeof(struct ar_hdr), 8) -
				sizeof(struct ar_hdr));
			archs[i].toc_long_name = TRUE;
		    }
		    if(archs[i].members[j].object != NULL){
			size += 
			   round(archs[i].members[j].object->object_size -
			     archs[i].members[j].object->input_sym_info_size +
			     archs[i].members[j].object->output_sym_info_size, 
			     8);
			sprintf(archs[i].members[j].ar_hdr->ar_size, "%-*ld",
			       (int)sizeof(archs[i].members[j].ar_hdr->ar_size),
			       (long)(size));
			/*
			 * This has to be done by hand because sprintf puts a
			 * null at the end of the buffer.
			 */
			memcpy(archs[i].members[j].ar_hdr->ar_fmag, ARFMAG,
			      (int)sizeof(archs[i].members[j].ar_hdr->ar_fmag));
		    }
		    else{
			size += archs[i].members[j].unknown_size;
		    }
		    offset += sizeof(struct ar_hdr) + size;
		}
		archs[i].library_size = offset;
	    }
	    else if(archs[i].type == OFILE_Mach_O){
		strip_object(archs + i, NULL, archs[i].object);
	    }
	    else {
		warning_arch(archs + i, NULL, "can't process non-object and "
			   "non-archive file: ");
		return;
	    }
	}
	if(all_archs == FALSE && narch_flags != 0){
	    for(i = 0; i < narch_flags; i++){
		if(arch_flag_processed[i] == FALSE)
		    error("file: %s does not contain architecture: %s",
			  archs[0].file_name, arch_flags[i].name);
	    }
	    free(arch_flag_processed);
	}
	if(any_processing == FALSE)
	    fatal("no processing done on input file: %s (specify a -arch flag)",
		  archs[0].file_name);
}

static
void
strip_object(
struct arch *arch,
struct member *member,
struct object *object)
{
    enum byte_sex host_byte_sex;
    struct nlist *symbols;
    struct nlist_64 *symbols64;
    unsigned long nsyms;
    char *strings;
    unsigned long strsize;
    unsigned long offset;
    struct dylib_table_of_contents *tocs;
    unsigned long ntoc;
    struct dylib_module *mods;
    struct dylib_module_64 *mods64;
    unsigned long nmodtab;
    struct dylib_reference *refs;
    unsigned long nextrefsyms;
    uint32_t *indirectsyms;
    unsigned long nindirectsyms;
    unsigned long i, j;
    struct load_command *lc;
    struct segment_command *sg;
    struct segment_command_64 *sg64;
    struct section *s;
    struct section_64 *s64;
    struct relocation_info *relocs;
    struct scattered_relocation_info *sreloc;
    long missing_reloc_symbols;
    unsigned long stride, section_type, nitems;
    char *contents;
#ifndef NMEDIT
    uint32_t flags;
    unsigned long k;
#endif
    uint32_t ncmds;

	host_byte_sex = get_host_byte_sex();

	/* Don't do anything to stub dylibs which have no load commands. */
	if(object->mh_filetype == MH_DYLIB_STUB){
	    if((object->mh != NULL && object->mh->ncmds == 0) ||
	       (object->mh64 != NULL && object->mh64->ncmds == 0)){
		return;
	    }
	}
	if(object->st == NULL || object->st->nsyms == 0){
	    warning_arch(arch, member, "input object file stripped: ");
	    return;
	}

	nsyms = object->st->nsyms;
	if(object->mh != NULL){
	    symbols = (struct nlist *)
		      (object->object_addr + object->st->symoff);
	    if(object->object_byte_sex != host_byte_sex)
		swap_nlist(symbols, nsyms, host_byte_sex);
	    symbols64 = NULL;
	}
	else{
	    symbols = NULL;
	    symbols64 = (struct nlist_64 *)
		        (object->object_addr + object->st->symoff);
	    if(object->object_byte_sex != host_byte_sex)
		swap_nlist_64(symbols64, nsyms, host_byte_sex);
	}
	strings = object->object_addr + object->st->stroff;
	strsize = object->st->strsize;

#ifndef NMEDIT
	if(object->mh != NULL)
	    flags = object->mh->flags;
	else
	    flags = object->mh64->flags;
	if(object->mh_filetype == MH_DYLIB &&
	   (flags & MH_PREBOUND) != MH_PREBOUND){
	    arch->dont_update_LC_ID_DYLIB_timestamp = TRUE;
	}
	if(object->mh_filetype != MH_DYLIB && cflag)
	    fatal_arch(arch, member, "-c can't be used on non-dynamic "
		       "library: ");
#endif /* !(NMEDIT) */
	if(object->mh_filetype == MH_DYLIB_STUB)
	    fatal_arch(arch, member, "dynamic stub library can't be changed "
		       "once created: ");

	if(object->mh_filetype == MH_DYLIB){
	    tocs = (struct dylib_table_of_contents *)
		    (object->object_addr + object->dyst->tocoff);
	    ntoc = object->dyst->ntoc;
	    nmodtab = object->dyst->nmodtab;
	    if(object->mh != NULL){
		mods = (struct dylib_module *)
			(object->object_addr + object->dyst->modtaboff);
		if(object->object_byte_sex != host_byte_sex)
		    swap_dylib_module(mods, nmodtab, host_byte_sex);
		mods64 = NULL;
	    }
	    else{
		mods = NULL;
		mods64 = (struct dylib_module_64 *)
			  (object->object_addr + object->dyst->modtaboff);
		if(object->object_byte_sex != host_byte_sex)
		    swap_dylib_module_64(mods64, nmodtab, host_byte_sex);
	    }
	    refs = (struct dylib_reference *)
		    (object->object_addr + object->dyst->extrefsymoff);
	    nextrefsyms = object->dyst->nextrefsyms;
	    if(object->object_byte_sex != host_byte_sex){
		swap_dylib_table_of_contents(tocs, ntoc, host_byte_sex);
		swap_dylib_reference(refs, nextrefsyms, host_byte_sex);
	    }
#ifndef NMEDIT
	    /* 
	     * In the -c flag is specified then strip the section contents of
	     * this dynamic library and change it into a stub library.  When
	     * creating a stub library the timestamp is not changed.
	     */
	    if(cflag){
		arch->dont_update_LC_ID_DYLIB_timestamp = TRUE;

		lc = object->load_commands;
		if(object->mh != NULL){
		    ncmds = object->mh->ncmds;
		    object->mh_filetype = MH_DYLIB_STUB;
		    object->mh->filetype = MH_DYLIB_STUB;
		}
		else{
		    ncmds = object->mh64->ncmds;
		    object->mh_filetype = MH_DYLIB_STUB;
		    object->mh64->filetype = MH_DYLIB_STUB;
		}
		for(i = 0; i < ncmds; i++){
		    if(lc->cmd == LC_SEGMENT){
			sg = (struct segment_command *)lc;
			if(strcmp(sg->segname, SEG_LINKEDIT) != 0){
			    /*
			     * Zero out the section offset, reloff, and size
			     * fields as the section contents are being removed.
			     */
			    s = (struct section *)
				 ((char *)sg + sizeof(struct segment_command));
			    for(j = 0; j < sg->nsects; j++){
				/*
				 * For section types with indirect tables we
				 * do not zero out the section size in a stub
				 * library.  As the section size is needed to
				 * know now many indirect table entries the
				 * section has.  This is a bit odd but programs
				 * dealing with MH_DYLIB_STUB filetypes special
				 * case this.
				 */ 
				section_type = s[j].flags & SECTION_TYPE;
				if(section_type != S_SYMBOL_STUBS &&
				   section_type != S_LAZY_SYMBOL_POINTERS &&
				   section_type != S_NON_LAZY_SYMBOL_POINTERS){
				    s[j].size = 0;
				}
				s[j].addr    = 0;
				s[j].offset  = 0;
				s[j].reloff  = 0;
			    }
			    /* zero out file offset and size in the segment */
			    sg->fileoff = 0;
			    sg->filesize = 0;
			}
		    }
		    else if(lc->cmd == LC_SEGMENT_64){
			sg64 = (struct segment_command_64 *)lc;
			if(strcmp(sg64->segname, SEG_LINKEDIT) != 0){
			    /*
			     * Zero out the section offset, reloff, and size
			     * fields as the section contents are being removed.
			     */
			    s64 = (struct section_64 *)
				  ((char *)sg64 +
				   sizeof(struct segment_command_64));
			    for(j = 0; j < sg64->nsects; j++){
				/*
				 * For section types with indirect tables we
				 * do not zero out the section size in a stub
				 * library.  As the section size is needed to
				 * know now many indirect table entries the
				 * section has.  This is a bit odd but programs
				 * dealing with MH_DYLIB_STUB filetypes special
				 * case this.
				 */ 
				section_type = s64[j].flags & SECTION_TYPE;
				if(section_type != S_SYMBOL_STUBS &&
				   section_type != S_LAZY_SYMBOL_POINTERS &&
				   section_type != S_NON_LAZY_SYMBOL_POINTERS){
				    s64[j].size = 0;
				}
				s64[j].addr    = 0;
				s64[j].offset  = 0;
				s64[j].reloff  = 0;
			    }
			    /* zero out file offset and size in the segment */
			    sg64->fileoff = 0;
			    sg64->filesize = 0;
			}
		    }
		    lc = (struct load_command *)((char *)lc + lc->cmdsize);
		}
		/*
		 * To get the right amount of the file copied out by writeout()
		 * for the case when we are stripping out the section contents
		 * we reduce the object size by the size of the section contents
		 * including the padding after the load commands.  Then this
		 * size minus the size of the input symbolic information is
		 * copied out.
		 */
		if(object->mh != NULL){
		    object->object_size -= (object->seg_linkedit->fileoff -
			(sizeof(struct mach_header) +
			object->mh->sizeofcmds));
		    /*
		     * Set the file offset to the link edit information to be
		     * right after the load commands.
		     */
		    object->seg_linkedit->fileoff = 
			sizeof(struct mach_header) +
			object->mh->sizeofcmds;
		}
		else{
		    object->object_size -= (object->seg_linkedit64->fileoff -
			(sizeof(struct mach_header_64) +
			 object->mh64->sizeofcmds));
		    /*
		     * Set the file offset to the link edit information to be
		     * right after the load commands.
		     */
		    object->seg_linkedit64->fileoff = 
			sizeof(struct mach_header_64) +
			object->mh64->sizeofcmds;
		}
	    }
#endif /* !(NMEDIT) */
	}
	else{
	    tocs = NULL;
	    ntoc = 0;
	    mods = NULL;
	    mods64 = NULL;
	    nmodtab = 0;
	    refs = NULL;
	    nextrefsyms = 0;
	}

	/*
	 * coalesced symbols can be stripped only if they are not used via an
	 * symbol pointer.  So to know that strip_symtab() needs to be passed
	 * the indirect symbol table.
	 */
	if(object->dyst != NULL && object->dyst->nindirectsyms != 0){
	    nindirectsyms = object->dyst->nindirectsyms;
	    indirectsyms = (uint32_t *)
		(object->object_addr + object->dyst->indirectsymoff);
	    if(object->object_byte_sex != host_byte_sex)
		swap_indirect_symbols(indirectsyms, nindirectsyms,
				      host_byte_sex);
	}
	else{
	    indirectsyms = NULL;
	    nindirectsyms = 0;
	}

	if(object->mh != NULL)
	    object->input_sym_info_size =
		nsyms * sizeof(struct nlist) +
		strsize;
	else
	    object->input_sym_info_size =
		nsyms * sizeof(struct nlist_64) +
		strsize;
#ifndef NMEDIT
	if(object->mh != NULL)
	    flags = object->mh->flags;
	else
	    flags = object->mh64->flags;
	if(strip_all &&
	   (flags & MH_DYLDLINK) == MH_DYLDLINK &&
	   object->mh_filetype == MH_EXECUTE)
	    default_dyld_executable = TRUE;
	else
	    default_dyld_executable = FALSE;
#endif /* !defined(NMEDIT) */

#ifndef NMEDIT
	if(sfile != NULL || Rfile != NULL || dfile != NULL || Aflag || aflag ||
	   uflag || Sflag || xflag || Xflag || tflag || nflag || rflag || 
	   default_dyld_executable || object->mh_filetype == MH_DYLIB ||
	   object->mh_filetype == MH_DYLINKER)
#endif /* !defined(NMEDIT) */
	    {
#ifdef NMEDIT
	    if(edit_symtab(arch, member, object, symbols, symbols64, nsyms,
		strings, strsize, tocs, ntoc, mods, mods64, nmodtab, refs,
		nextrefsyms) == FALSE)
		return;
#else /* !defined(NMEDIT) */
	    if(strip_symtab(arch, member, object, symbols, symbols64, nsyms,
		strings, strsize, tocs, ntoc, mods, mods64, nmodtab, refs,
		nextrefsyms, indirectsyms, nindirectsyms) == FALSE)
		return;
	    if(no_uuid == TRUE)
		strip_LC_UUID_commands(arch, member, object);
#endif /* !defined(NMEDIT) */
	    if(object->mh != NULL)
		object->output_sym_info_size =
		    new_nsyms * sizeof(struct nlist) +
		    new_strsize;
	    else
		object->output_sym_info_size =
		    new_nsyms * sizeof(struct nlist_64) +
		    new_strsize;

	    object->st->nsyms = new_nsyms; 
	    object->st->strsize = new_strsize;

	    if(object->mh != NULL)
		object->output_symbols = new_symbols;
	    else
		object->output_symbols64 = new_symbols64;
	    object->output_nsymbols = new_nsyms;
	    object->output_strings = new_strings;
	    object->output_strings_size = new_strsize;

	    if(object->split_info_cmd != NULL){
		object->output_split_info_data = object->object_addr +
		    object->split_info_cmd->dataoff;
		object->output_split_info_data_size = 
		    object->split_info_cmd->datasize;
	    }
	    if(object->code_sig_cmd != NULL){
#ifndef NMEDIT
		if(!cflag && !no_code_signature)
#endif /* !(NMEDIT) */
		{
		    object->output_code_sig_data = object->object_addr +
			object->code_sig_cmd->dataoff;
		    object->output_code_sig_data_size = 
			object->code_sig_cmd->datasize;
		}
	    }

	    if(object->dyst != NULL){
		object->dyst->ilocalsym = 0;
		object->dyst->nlocalsym = new_nlocalsym;
		object->dyst->iextdefsym = new_nlocalsym;
		object->dyst->nextdefsym = new_nextdefsym;
		object->dyst->iundefsym = new_nlocalsym + new_nextdefsym;
		object->dyst->nundefsym = new_nundefsym;
		if(object->dyst->nindirectsyms != 0){
		    object->output_indirect_symtab = indirectsyms;
		    if(object->object_byte_sex != host_byte_sex)
			swap_indirect_symbols(indirectsyms, nindirectsyms,
					      object->object_byte_sex);
		}

		/*
		 * If the -c option is specified the object's filetype will
		 * have been changed from MH_DYLIB to MH_DYLIB_STUB above.
		 */
		if(object->mh_filetype == MH_DYLIB ||
		   object->mh_filetype == MH_DYLIB_STUB){
		    object->output_tocs = new_tocs;
		    object->output_ntoc = new_ntoc;
#ifdef NMEDIT
		    if(object->mh != NULL)
			object->output_mods = new_mods;
		    else
			object->output_mods64 = new_mods64;
		    object->output_nmodtab = new_nmodtab;
#else
		    object->output_mods = mods;
		    object->output_nmodtab = nmodtab;
#endif
		    object->output_refs = new_refs;
		    object->output_nextrefsyms = new_nextrefsyms;
		    if(object->object_byte_sex != host_byte_sex){
			swap_dylib_table_of_contents(new_tocs, new_ntoc,
			    object->object_byte_sex);
#ifdef NMEDIT
			if(object->mh != NULL)
			    swap_dylib_module(new_mods, new_nmodtab,
				object->object_byte_sex);
			else
			    swap_dylib_module_64(new_mods64, new_nmodtab,
				object->object_byte_sex);
#else
			if(object->mh != NULL)
			    swap_dylib_module(mods, nmodtab,
				object->object_byte_sex);
			else
			    swap_dylib_module_64(mods64, nmodtab,
				object->object_byte_sex);
#endif
			swap_dylib_reference(new_refs, new_nextrefsyms,
			    object->object_byte_sex);
		    }
		}
		object->input_sym_info_size +=
		    object->dyst->nlocrel * sizeof(struct relocation_info) +
		    object->dyst->nextrel * sizeof(struct relocation_info) +
		    object->dyst->ntoc * sizeof(struct dylib_table_of_contents)+
		    object->dyst->nextrefsyms * sizeof(struct dylib_reference);
		if(object->mh != NULL){
		    object->input_sym_info_size +=
			object->dyst->nmodtab * sizeof(struct dylib_module) +
			object->dyst->nindirectsyms * sizeof(uint32_t);
		}
		else{
		    object->input_sym_info_size +=
			object->dyst->nmodtab * sizeof(struct dylib_module_64) +
			object->dyst->nindirectsyms * sizeof(uint32_t) +
			object->input_indirectsym_pad;
		}
#ifndef NMEDIT
		/*
		 * When stripping out the section contents to create a
		 * dynamic library stub the relocation info also gets
		 * stripped.
		 */
		if(!cflag) 
#endif /* !(NMEDIT) */
		{
		    object->output_sym_info_size +=
			object->dyst->nlocrel * sizeof(struct relocation_info) +
			object->dyst->nextrel * sizeof(struct relocation_info);
		}
		object->output_sym_info_size +=
		    new_ntoc * sizeof(struct dylib_table_of_contents)+
		    new_nextrefsyms * sizeof(struct dylib_reference) +
		    object->dyst->nindirectsyms * sizeof(uint32_t) +
		    object->input_indirectsym_pad;
		if(object->mh != NULL){
		    object->output_sym_info_size +=
			object->dyst->nmodtab * sizeof(struct dylib_module);
		}
		else{
		    object->output_sym_info_size +=
			object->dyst->nmodtab * sizeof(struct dylib_module_64);
		}
		if(object->hints_cmd != NULL){
		    object->input_sym_info_size +=
			object->hints_cmd->nhints *
			sizeof(struct twolevel_hint);
		    object->output_sym_info_size +=
			object->hints_cmd->nhints *
			sizeof(struct twolevel_hint);
		}
		if(object->split_info_cmd != NULL){
		    object->input_sym_info_size +=
			object->split_info_cmd->datasize;
		    object->output_sym_info_size +=
			object->split_info_cmd->datasize;
		}
		if(object->code_sig_cmd != NULL){
		    object->input_sym_info_size =
			round(object->input_sym_info_size, 16);
		    object->input_sym_info_size +=
			object->code_sig_cmd->datasize;
#ifndef NMEDIT
		    if(cflag || no_code_signature){
			strip_LC_CODE_SIGNATURE_commands(arch, member, object);
		    }
		    else
#endif /* !(NMEDIT) */
		    {
			object->output_sym_info_size =
			    round(object->output_sym_info_size, 16);
			object->output_sym_info_size +=
			    object->code_sig_cmd->datasize;
		    }
		}

		object->dyst->ntoc = new_ntoc;
		object->dyst->nextrefsyms = new_nextrefsyms;

		if(object->seg_linkedit != NULL ||
		   object->seg_linkedit64 != NULL){
		    if(object->mh != NULL)
			offset = object->seg_linkedit->fileoff;
		    else
			offset = object->seg_linkedit64->fileoff;
		}
		else{
		    offset = ULONG_MAX;
		    if(object->dyst->nlocrel != 0 &&
		       object->dyst->locreloff < offset)
			offset = object->dyst->locreloff;
		    if(object->st->nsyms != 0 &&
		       object->st->symoff < offset)
			offset = object->st->symoff;
		    if(object->dyst->nextrel != 0 &&
		       object->dyst->extreloff < offset)
			offset = object->dyst->extreloff;
		    if(object->dyst->nindirectsyms != 0 &&
		       object->dyst->indirectsymoff < offset)
			offset = object->dyst->indirectsymoff;
		    if(object->dyst->ntoc != 0 &&
		       object->dyst->tocoff < offset)
			offset = object->dyst->tocoff;
		    if(object->dyst->nmodtab != 0 &&
		       object->dyst->modtaboff < offset)
			offset = object->dyst->modtaboff;
		    if(object->dyst->nextrefsyms != 0 &&
		       object->dyst->extrefsymoff < offset)
			offset = object->dyst->extrefsymoff;
		    if(object->st->strsize != 0 &&
		       object->st->stroff < offset)
			offset = object->st->stroff;
		} 

		if(object->dyst->nlocrel != 0){
		    object->output_loc_relocs = (struct relocation_info *)
			(object->object_addr + object->dyst->locreloff);
#ifndef NMEDIT
		    /*
		     * When stripping out the section contents to create a
		     * dynamic library stub the relocation info also gets
		     * stripped.
		     */
		    if(cflag){
			object->dyst->nlocrel = 0;
			object->dyst->locreloff = 0;
		    }
		    else
#endif /* defined(NMEDIT) */
		    {
			object->dyst->locreloff = offset;
			offset += object->dyst->nlocrel *
				  sizeof(struct relocation_info);
		    }
		}
		else
		    object->dyst->locreloff = 0;

		if(object->split_info_cmd != NULL){
		    object->split_info_cmd->dataoff = offset;
		    offset += object->split_info_cmd->datasize;
		}

		if(object->st->nsyms != 0){
		    object->st->symoff = offset;
		    if(object->mh != NULL)
			offset += object->st->nsyms * sizeof(struct nlist);
		    else
			offset += object->st->nsyms * sizeof(struct nlist_64);
		}
		else
		    object->st->symoff = 0;

		if(object->hints_cmd != NULL){
		    if(object->hints_cmd->nhints != 0){
			object->output_hints = (struct twolevel_hint *)
			    (object->object_addr + object->hints_cmd->offset);
			object->hints_cmd->offset = offset;
			offset += object->hints_cmd->nhints *
				  sizeof(struct twolevel_hint);
		    }
		    else
			object->hints_cmd->offset = 0;
		}

		if(object->dyst->nextrel != 0){
		    object->output_ext_relocs = (struct relocation_info *)
			(object->object_addr + object->dyst->extreloff);
#ifndef NMEDIT
		    /*
		     * When stripping out the section contents to create a
		     * dynamic library stub the relocation info also gets
		     * stripped.
		     */
		    if(cflag){
			object->dyst->nextrel = 0;
			object->dyst->extreloff = 0;
		    }
		    else
#endif /* defined(NMEDIT) */
		    {
			object->dyst->extreloff = offset;
			offset += object->dyst->nextrel *
			    sizeof(struct relocation_info);
		    }
		}
		else
		    object->dyst->extreloff = 0;

		if(object->dyst->nindirectsyms != 0){
		    object->dyst->indirectsymoff = offset;
		    offset += object->dyst->nindirectsyms * sizeof(uint32_t) +
			      object->input_indirectsym_pad;
		}
		else
		    object->dyst->indirectsymoff = 0;;

		if(object->dyst->ntoc != 0){
		    object->dyst->tocoff = offset;
		    offset += object->dyst->ntoc *
			      sizeof(struct dylib_table_of_contents);
		}
		else
		    object->dyst->tocoff = 0;

		if(object->dyst->nmodtab != 0){
#ifndef NMEDIT
		    /*
		     * When stripping out the section contents to create a
		     * dynamic library stub zero out the fields in the module
		     * table for the sections and relocation information and
		     * clear Objective-C address and size from modules.
		     */
		    if(cflag){
			if(object->mh != NULL){
			    for(k = 0; k < object->dyst->nmodtab; k++){
				mods[k].iinit_iterm = 0;
				mods[k].ninit_nterm = 0;
				mods[k].iextrel = 0;
				mods[k].nextrel = 0;
				mods[k].objc_module_info_addr = 0;
				mods[k].objc_module_info_size = 0;
			    }
			}
			else{
			    for(k = 0; k < object->dyst->nmodtab; k++){
				mods64[k].iinit_iterm = 0;
				mods64[k].ninit_nterm = 0;
				mods64[k].iextrel = 0;
				mods64[k].nextrel = 0;
				mods64[k].objc_module_info_addr = 0;
				mods64[k].objc_module_info_size = 0;
			    }
			}
		    }
#endif /* !(NMEDIT) */
		    object->dyst->modtaboff = offset;
		    if(object->mh != NULL)
			offset += object->dyst->nmodtab *
				  sizeof(struct dylib_module);
		    else
			offset += object->dyst->nmodtab *
				  sizeof(struct dylib_module_64);
		}
		else
		    object->dyst->modtaboff = 0;

		if(object->dyst->nextrefsyms != 0){
		    object->dyst->extrefsymoff = offset;
		    offset += object->dyst->nextrefsyms *
			      sizeof(struct dylib_reference);
		}
		else
		    object->dyst->extrefsymoff = 0;

		if(object->st->strsize != 0){
		    object->st->stroff = offset;
		    offset += object->st->strsize;
		}
		else
		    object->st->stroff = 0;

		if(object->code_sig_cmd != NULL){
		    offset = round(offset, 16);
		    object->code_sig_cmd->dataoff = offset;
		    offset += object->code_sig_cmd->datasize;
		}
	    }
	    else{
		if(new_strsize != 0){
		    if(object->mh != NULL)
			object->st->stroff = object->st->symoff +
					 new_nsyms * sizeof(struct nlist);
		    else
			object->st->stroff = object->st->symoff +
					 new_nsyms * sizeof(struct nlist_64);
		}
		else
		    object->st->stroff = 0;
		if(new_nsyms == 0)
		    object->st->symoff = 0;
	    }
	}
#ifndef NMEDIT
	else{
	    if(saves != NULL)
		free(saves);
	    saves = (long *)allocate(object->st->nsyms * sizeof(long));
	    bzero(saves, object->st->nsyms * sizeof(long));

	    object->output_sym_info_size = 0;
	    object->st->symoff = 0;
	    object->st->nsyms = 0;
	    object->st->stroff = 0;
	    object->st->strsize = 0;
	    if(object->dyst != NULL){
		object->dyst->ilocalsym = 0;
		object->dyst->nlocalsym = 0;
		object->dyst->iextdefsym = 0;
		object->dyst->nextdefsym = 0;
		object->dyst->iundefsym = 0;
		object->dyst->nundefsym = 0;
	    }
	    /*
	     * We set these so that checking can be done below to report the
	     * symbols that can't be stripped because of relocation entries
	     * or indirect symbol table entries.  If these table are non-zero
	     * number of entries it will be an error as we are trying to
	     * strip everything.
	     */
	    if(object->dyst != NULL){
		if(object->dyst->nextrel != 0){
		    object->output_ext_relocs = (struct relocation_info *)
			(object->object_addr + object->dyst->extreloff);
		}
		if(object->dyst->nindirectsyms != 0){
		    object->output_indirect_symtab = (uint32_t *)
			(object->object_addr +
			 object->dyst->indirectsymoff);
		    if(object->object_byte_sex != host_byte_sex)
			swap_indirect_symbols(
			    object->output_indirect_symtab,
			    object->dyst->nindirectsyms,
			    object->object_byte_sex);
		}
		/*
		 * Since this file has a dynamic symbol table and if this file
		 * has local relocation entries on input make sure they are
		 * there on output.  This is a rare case that it will not have
		 * external relocs or indirect symbols but can happen as is the
		 * case with the dynamic linker itself.
		 */
		if(object->dyst->nlocrel != 0){
		    object->output_loc_relocs = (struct relocation_info *)
			(object->object_addr + object->dyst->locreloff);
		    object->output_sym_info_size +=
			object->dyst->nlocrel * sizeof(struct relocation_info);
		}
	    }
	}
#endif /* !defined(NMEDIT) */

	/*
	 * Always clear the prebind checksum if any when creating a new file.
	 */
	if(object->cs != NULL)
	    object->cs->cksum = 0;

	if(object->seg_linkedit != NULL){
	    object->seg_linkedit->filesize += object->output_sym_info_size -
					      object->input_sym_info_size;
	    object->seg_linkedit->vmsize = object->seg_linkedit->filesize;
	}
	else if(object->seg_linkedit64 != NULL){
	    /* Do this in two steps to avoid 32/64-bit casting problems. */
	    object->seg_linkedit64->filesize -= object->input_sym_info_size;
	    object->seg_linkedit64->filesize += object->output_sym_info_size;
	    object->seg_linkedit64->vmsize = object->seg_linkedit64->filesize;
	}

	/*
	 * Check and update the external relocation entries to make sure
	 * referenced symbols are not stripped and refer to the new symbol
	 * table indexes.
	 * 
	 * The external relocation entries can be located in one of two places,
	 * first off of the sections or second off of the dynamic symtab.
	 */
	missing_reloc_symbols = 0;
	lc = object->load_commands;
	if(object->mh != NULL)
	    ncmds = object->mh->ncmds;
	else
	    ncmds = object->mh64->ncmds;
	for(i = 0; i < ncmds; i++){
	    if(lc->cmd == LC_SEGMENT &&
	       object->seg_linkedit != (struct segment_command *)lc){
		sg = (struct segment_command *)lc;
		s = (struct section *)((char *)sg +
					sizeof(struct segment_command));
		for(j = 0; j < sg->nsects; j++){
		    if(s->nreloc != 0){
			if(s->reloff + s->nreloc *
			   sizeof(struct relocation_info) >
						object->object_size){
			    fatal_arch(arch, member, "truncated or malformed "
				"object (relocation entries for section (%.16s,"
				"%.16s) extends past the end of the file)",
				s->segname, s->sectname);
			}
			relocs = (struct relocation_info *)
					(object->object_addr + s->reloff);
			if(object->object_byte_sex != host_byte_sex)
			    swap_relocation_info(relocs, s->nreloc,
						 host_byte_sex);
			if(s->offset + s->size > object->object_size){
			    fatal_arch(arch, member, "truncated or malformed "
				"object (contents of section (%.16s,"
				"%.16s) extends past the end of the file)",
				s->segname, s->sectname);
			}
			contents = object->object_addr + s->offset;
			check_object_relocs(arch, member, object, s->segname,
    			    s->sectname, s->size, contents, relocs, s->nreloc,
			    symbols, symbols64, nsyms, strings,
			    &missing_reloc_symbols, host_byte_sex);
			if(object->object_byte_sex != host_byte_sex)
			    swap_relocation_info(relocs, s->nreloc,
						 object->object_byte_sex);
		    }
		    s++;
		}
	    }
	    else if(lc->cmd == LC_SEGMENT_64 &&
	       object->seg_linkedit64 != (struct segment_command_64 *)lc){
		sg64 = (struct segment_command_64 *)lc;
		s64 = (struct section_64 *)((char *)sg64 +
					sizeof(struct segment_command_64));
		for(j = 0; j < sg64->nsects; j++){
		    if(s64->nreloc != 0){
			if(s64->reloff + s64->nreloc *
			   sizeof(struct relocation_info) >
						object->object_size){
			    fatal_arch(arch, member, "truncated or malformed "
				"object (relocation entries for section (%.16s,"
				"%.16s) extends past the end of the file)",
				s64->segname, s64->sectname);
			}
			relocs = (struct relocation_info *)
					(object->object_addr + s64->reloff);
			if(object->object_byte_sex != host_byte_sex)
			    swap_relocation_info(relocs, s64->nreloc,
						 host_byte_sex);
			if(s64->offset + s64->size > object->object_size){
			    fatal_arch(arch, member, "truncated or malformed "
				"object (contents of section (%.16s,"
				"%.16s) extends past the end of the file)",
				s64->segname, s64->sectname);
			}
			contents = object->object_addr + s64->offset;
			check_object_relocs(arch, member, object, s64->segname,
    			    s64->sectname, s64->size, contents, relocs,
			    s64->nreloc, symbols, symbols64, nsyms, strings,
			    &missing_reloc_symbols, host_byte_sex);
			if(object->object_byte_sex != host_byte_sex)
			    swap_relocation_info(relocs, s64->nreloc,
						 object->object_byte_sex);
		    }
		    s64++;
		}
	    }
	    lc = (struct load_command *)((char *)lc + lc->cmdsize);
	}
	if(object->dyst != NULL && object->dyst->nextrel != 0){
	    relocs = object->output_ext_relocs;
	    if(object->object_byte_sex != host_byte_sex)
		swap_relocation_info(relocs, object->dyst->nextrel,
				     host_byte_sex);

	    for(i = 0; i < object->dyst->nextrel; i++){
		if((relocs[i].r_address & R_SCATTERED) == 0 &&
		   relocs[i].r_extern == 1){
		    if(relocs[i].r_symbolnum > nsyms){
			fatal_arch(arch, member, "bad r_symbolnum for external "
			    "relocation entry %ld in: ", i);
		    }
		    if(saves[relocs[i].r_symbolnum] == 0){
			if(missing_reloc_symbols == 0){
			    error_arch(arch, member, "symbols referenced by "
			      "relocation entries that can't be stripped in: ");
			    missing_reloc_symbols = 1;
			}
			if(object->mh != NULL){
			    fprintf(stderr, "%s\n", strings + symbols
			            [relocs[i].r_symbolnum].n_un.n_strx);
			}
			else {
			    fprintf(stderr, "%s\n", strings + symbols64
			            [relocs[i].r_symbolnum].n_un.n_strx);
			}
			saves[relocs[i].r_symbolnum] = -1;
		    }
		    if(saves[relocs[i].r_symbolnum] != -1){
			relocs[i].r_symbolnum =
			    saves[relocs[i].r_symbolnum] - 1;
		    }
		}
		else{
		    fatal_arch(arch, member, "bad external relocation entry "
			"%ld (not external) in: ", i);
		}
		if((relocs[i].r_address & R_SCATTERED) == 0){
		    if(reloc_has_pair(object->mh_cputype, relocs[i].r_type))
			i++;
		}
		else{
		    sreloc = (struct scattered_relocation_info *)relocs + i;
		    if(reloc_has_pair(object->mh_cputype, sreloc->r_type))
			i++;
		}
	    }
	    if(object->object_byte_sex != host_byte_sex)
		swap_relocation_info(relocs, object->dyst->nextrel,
				     object->object_byte_sex);
	}

	/*
	 * Check and update the indirect symbol table entries to make sure
	 * referenced symbols are not stripped and refer to the new symbol
	 * table indexes.
	 */
	if(object->dyst != NULL && object->dyst->nindirectsyms != 0){
	    if(object->object_byte_sex != host_byte_sex)
		swap_indirect_symbols(object->output_indirect_symtab,
		    object->dyst->nindirectsyms, host_byte_sex);

	    lc = object->load_commands;
	    if(object->mh != NULL)
		ncmds = object->mh->ncmds;
	    else
		ncmds = object->mh64->ncmds;
	    for(i = 0; i < ncmds; i++){
		if(lc->cmd == LC_SEGMENT &&
		   object->seg_linkedit != (struct segment_command *)lc){
		    sg = (struct segment_command *)lc;
		    s = (struct section *)((char *)sg +
					    sizeof(struct segment_command));
		    for(j = 0; j < sg->nsects; j++){
			section_type = s->flags & SECTION_TYPE;
			if(section_type == S_LAZY_SYMBOL_POINTERS ||
			   section_type == S_NON_LAZY_SYMBOL_POINTERS)
			  stride = 4;
			else if(section_type == S_SYMBOL_STUBS)
			    stride = s->reserved2;
			else{
			    s++;
			    continue;
			}
			nitems = s->size / stride;
			contents = object->object_addr + s->offset;
			check_indirect_symtab(arch, member, object, nitems,
			    s->reserved1, section_type, contents, symbols,
			    symbols64, nsyms, strings, &missing_reloc_symbols,
			    host_byte_sex);
			s++;
		    }
		}
		else if(lc->cmd == LC_SEGMENT_64 &&
		   object->seg_linkedit64 != (struct segment_command_64 *)lc){
		    sg64 = (struct segment_command_64 *)lc;
		    s64 = (struct section_64 *)((char *)sg64 +
					    sizeof(struct segment_command_64));
		    for(j = 0; j < sg64->nsects; j++){
			section_type = s64->flags & SECTION_TYPE;
			if(section_type == S_LAZY_SYMBOL_POINTERS ||
			   section_type == S_NON_LAZY_SYMBOL_POINTERS)
			  stride = 8;
			else if(section_type == S_SYMBOL_STUBS)
			    stride = s64->reserved2;
			else{
			    s64++;
			    continue;
			}
			nitems = s64->size / stride;
			contents = object->object_addr + s64->offset;
			check_indirect_symtab(arch, member, object, nitems,
			    s64->reserved1, section_type, contents, symbols,
			    symbols64, nsyms, strings, &missing_reloc_symbols,
			    host_byte_sex);
			s64++;
		    }
		}
		lc = (struct load_command *)((char *)lc + lc->cmdsize);
	    }

	    if(object->object_byte_sex != host_byte_sex)
		swap_indirect_symbols(object->output_indirect_symtab,
		    object->dyst->nindirectsyms, object->object_byte_sex);
	}

	/*
	 * Issue a warning if object file has a code signature that the
	 * operation will invalidate it.
	 */
	if(object->code_sig_cmd != NULL)
	    warning_arch(arch, member, "changes being made to the file will "
		"invalidate the code signature in: ");
}

/*
 * check_object_relocs() is used to check and update the external relocation
 * entries from a section in an object file, to make sure referenced symbols
 * are not stripped and are changed to refer to the new symbol table indexes.
 */
static
void
check_object_relocs(
struct arch *arch,
struct member *member,
struct object *object,
char *segname,
char *sectname,
unsigned long long sectsize,
char *contents,
struct relocation_info *relocs,
uint32_t nreloc,
struct nlist *symbols,
struct nlist_64 *symbols64,
unsigned long nsyms,
char *strings,
long *missing_reloc_symbols,
enum byte_sex host_byte_sex)
{
    unsigned long k, n_strx;
    uint64_t n_value;
#ifdef NMEDIT
    unsigned long value, n_ext;
    uint64_t value64; 
#endif
    struct scattered_relocation_info *sreloc;

	for(k = 0; k < nreloc; k++){
	    if((relocs[k].r_address & R_SCATTERED) == 0 &&
	       relocs[k].r_extern == 1){
		if(relocs[k].r_symbolnum > nsyms){
		    fatal_arch(arch, member, "bad r_symbolnum for relocation "
			"entry %ld in section (%.16s,%.16s) in: ", k, segname,
			sectname);
		}
		if(object->mh != NULL){
		    n_strx = symbols[relocs[k].r_symbolnum].n_un.n_strx;
		    n_value = symbols[relocs[k].r_symbolnum].n_value;
		}
		else{
		    n_strx = symbols64[relocs[k].r_symbolnum].n_un.n_strx;
		    n_value = symbols64[relocs[k].r_symbolnum].n_value;
		}
#ifndef NMEDIT
		if(saves[relocs[k].r_symbolnum] == 0){
		    if(*missing_reloc_symbols == 0){
			error_arch(arch, member, "symbols referenced by "
			    "relocation entries that can't be stripped in: ");
			*missing_reloc_symbols = 1;
		    }
		    fprintf(stderr, "%s\n", strings + n_strx);
		    saves[relocs[k].r_symbolnum] = -1;
		}
#else /* defined(NMEDIT) */
		/*
		 * We are letting nmedit change global coalesed symbols into
		 * statics in MH_OBJECT file types only. Relocation entries to
		 * global coalesced symbols are external relocs.
		 */
		if(object->mh != NULL)
		    n_ext = new_symbols[saves[relocs[k].r_symbolnum] - 1].
				n_type & N_EXT;
		else
		    n_ext = new_symbols64[saves[relocs[k].r_symbolnum] - 1].
				n_type & N_EXT;
		if(n_ext != N_EXT &&
		   object->mh_cputype != CPU_TYPE_X86_64){
		    /*
		     * We need to do the relocation for this external relocation
		     * entry so the item to be relocated is correct for a local
		     * relocation entry. We don't need to do this for x86-64.
		     */
		    if(relocs[k].r_address + sizeof(long) > sectsize){
			fatal_arch(arch, member, "truncated or malformed "
			    "object (r_address of relocation entry %lu of "
			    "section (%.16s,%.16s) extends past the end "
			    "of the section)", k, segname, sectname);
		    }
		    if(object->mh != NULL){
			value = *(unsigned long *)
				 (contents + relocs[k].r_address);
			if(object->object_byte_sex != host_byte_sex)
			    value = SWAP_LONG(value);
			/*
			 * We handle a very limited form here.  Only VANILLA
			 * (r_type == 0) long (r_length==2) absolute or pcrel
			 * that won't need a scattered relocation entry.
			 */
			if(relocs[k].r_type != 0 ||
			   relocs[k].r_length != 2){
			    fatal_arch(arch, member, "don't have "
			      "code to convert external relocation "
			      "entry %ld in section (%.16s,%.16s) "
			      "for global coalesced symbol: %s "
			      "in: ", k, segname, sectname,
			      strings + n_strx);
			}
			value += n_value;
			if(object->object_byte_sex != host_byte_sex)
			    value = SWAP_LONG(value);
			*(unsigned long *)(contents + relocs[k].r_address) =
			    value;
		    }
		    else{
			value64 = *(uint64_t *)(contents + relocs[k].r_address);
			if(object->object_byte_sex != host_byte_sex)
			    value64 = SWAP_LONG_LONG(value64);
			/*
			 * We handle a very limited form here.  Only VANILLA
			 * (r_type == 0) quad (r_length==3) absolute or pcrel
			 * that won't need a scattered relocation entry.
			 */
			if(relocs[k].r_type != 0 ||
			   relocs[k].r_length != 3){
			    fatal_arch(arch, member, "don't have "
			      "code to convert external relocation "
			      "entry %ld in section (%.16s,%.16s) "
			      "for global coalesced symbol: %s "
			      "in: ", k, segname, sectname,
			      strings + n_strx);
			}
			value64 += n_value;
			if(object->object_byte_sex != host_byte_sex)
			    value64 = SWAP_LONG_LONG(value);
			*(uint64_t *)(contents + relocs[k].r_address) = value64;
		    }
		    /*
		     * Turn the extern reloc into a local.
		     */
		    if(object->mh != NULL)
			relocs[k].r_symbolnum =
			 new_symbols[saves[relocs[k].r_symbolnum] - 1].n_sect;
		    else
			relocs[k].r_symbolnum =
			 new_symbols64[saves[relocs[k].r_symbolnum] - 1].n_sect;
		    relocs[k].r_extern = 0;
		}
#endif /* NMEDIT */
		if(relocs[k].r_extern == 1 &&
		   saves[relocs[k].r_symbolnum] != -1){
		    relocs[k].r_symbolnum = saves[relocs[k].r_symbolnum] - 1;
		}
	    }
	    if((relocs[k].r_address & R_SCATTERED) == 0){
		if(reloc_has_pair(object->mh_cputype, relocs[k].r_type) == TRUE)
		    k++;
	    }
	    else{
		sreloc = (struct scattered_relocation_info *)relocs + k;
		if(reloc_has_pair(object->mh_cputype, sreloc->r_type) == TRUE)
		    k++;
	    }
	}
}

/*
 * check_indirect_symtab() checks and updates the indirect symbol table entries
 * to make sure referenced symbols are not stripped and refer to the new symbol
 * table indexes.
 */
static
void
check_indirect_symtab(
struct arch *arch,
struct member *member,
struct object *object,
unsigned long nitems,
unsigned long reserved1,
unsigned long section_type,
char *contents,
struct nlist *symbols,
struct nlist_64 *symbols64,
unsigned long nsyms,
char *strings,
long *missing_reloc_symbols,
enum byte_sex host_byte_sex)
{
    unsigned long k, index;
    uint8_t n_type;
    uint32_t n_strx, value;
    uint64_t value64;
    enum bool made_local;

	for(k = 0; k < nitems; k++){
	    made_local = FALSE;
	    index = object->output_indirect_symtab[reserved1 + k];
	    if(index == INDIRECT_SYMBOL_LOCAL ||
	       index == INDIRECT_SYMBOL_ABS ||
	       index == (INDIRECT_SYMBOL_LOCAL | INDIRECT_SYMBOL_ABS))
		continue;
	    if(index > nsyms)
		fatal_arch(arch, member,"indirect symbol table entry %ld (past "		    "the end of the symbol table) in: ", reserved1 + k);
#ifdef NMEDIT
	    if(pflag == 0 && nmedits[index] == TRUE && saves[index] != -1)
#else
	    if(saves[index] == 0)
#endif
	    {
		/*
		 * Indirect symbol table entries for defined symbols in a
		 * non-lazy pointer section that are not saved are changed to
		 * INDIRECT_SYMBOL_LOCAL which their values just have to be
		 * slid if the are not absolute symbols.
		 */
		if(object->mh != NULL){
		    n_type = symbols[index].n_type;
		    n_strx = symbols[index].n_un.n_strx;
		}
		else{
		    n_type = symbols64[index].n_type;
		    n_strx = symbols64[index].n_un.n_strx;
		}
		if((n_type && N_TYPE) != N_UNDF &&
		   (n_type && N_TYPE) != N_PBUD &&
		   section_type == S_NON_LAZY_SYMBOL_POINTERS){
		    object->output_indirect_symtab[reserved1 + k] =
			    INDIRECT_SYMBOL_LOCAL;
		    if((n_type & N_TYPE) == N_ABS)
			object->output_indirect_symtab[reserved1 + k] |=
				INDIRECT_SYMBOL_ABS;
		    made_local = TRUE;
		    /*
		     * When creating a stub shared library the section contents
		     * are not updated since they will be stripped.
		     */
		    if(object->mh_filetype != MH_DYLIB_STUB){
			if(object->mh != NULL){
			    value = symbols[index].n_value;
			    if(object->object_byte_sex != host_byte_sex)
				value = SWAP_LONG(value);
			    *(uint32_t *)(contents + k * 4) = value;
			}
			else{
			    value64 = symbols64[index].n_value;
			    if(object->object_byte_sex != host_byte_sex)
				value64 = SWAP_LONG_LONG(value64);
			    *(uint64_t *)(contents + k * 8) = value64;
			}
		    }
		}
#ifdef NMEDIT
		else {
		    object->output_indirect_symtab[reserved1 + k] =
			saves[index] - 1;
		}
#else /* !defined(NMEDIT) */
		else{
		    if(*missing_reloc_symbols == 0){
			error_arch(arch, member, "symbols referenced by "
			    "indirect symbol table entries that can't be "
			    "stripped in: ");
			*missing_reloc_symbols = 1;
		    }
		    fprintf(stderr, "%s\n", strings + n_strx);
		    saves[index] = -1;
		}
#endif /* !defined(NMEDIT) */
	    }
#ifdef NMEDIT
	    else
#else /* !defined(NMEDIT) */
	    if(made_local == FALSE && saves[index] != -1)
#endif /* !defined(NMEDIT) */
	    {
		object->output_indirect_symtab[reserved1+k] = saves[index] - 1;
	    }
	}
}

#ifndef NMEDIT
/*
 * This is called if there is a -d option specified.  It reads the file with
 * the strings in it and places them in the array debug_filenames and sorts
 * them by name.  The file that contains the file names must have names one
 * per line with no white space (except the newlines).
 */
static
void
setup_debug_filenames(
char *dfile)
{
    int fd, i, strings_size;
    struct stat stat_buf;
    char *strings, *p;

	if((fd = open(dfile, O_RDONLY)) < 0){
	    system_error("can't open: %s", dfile);
	    return;
	}
	if(fstat(fd, &stat_buf) == -1){
	    system_error("can't stat: %s", dfile);
	    close(fd);
	    return;
	}
	strings_size = stat_buf.st_size;
	strings = (char *)allocate(strings_size + 1);
	strings[strings_size] = '\0';
	if(read(fd, strings, strings_size) != strings_size){
	    system_error("can't read: %s", dfile);
	    close(fd);
	    return;
	}
	p = strings;
	for(i = 0; i < strings_size; i++){
	    if(*p == '\n'){
		*p = '\0';
		ndebug_filenames++;
	    }
	    p++;
	}
	debug_filenames = (char **)allocate(ndebug_filenames * sizeof(char *));
	p = strings;
	for(i = 0; i < ndebug_filenames; i++){
	    debug_filenames[i] = p;
	    p += strlen(p) + 1;
	}
	qsort(debug_filenames, ndebug_filenames, sizeof(char *),
	      (int (*)(const void *, const void *))cmp_qsort_filename);

#ifdef DEBUG
	printf("Debug filenames:\n");
	for(i = 0; i < ndebug_filenames; i++){
	    printf("filename = %s\n", debug_filenames[i]);
	}
#endif /* DEBUG */
}

/*
 * Strip the symbol table to the level specified by the command line arguments.
 * The new symbol table is built and new_symbols is left pointing to it.  The
 * number of new symbols is left in new_nsyms, the new string table is built
 * and new_stings is left pointing to it and new_strsize is left containing it.
 * This routine returns zero if successfull and non-zero otherwise.
 */
static
enum bool
strip_symtab(
struct arch *arch,
struct member *member,
struct object *object,
struct nlist *symbols,
struct nlist_64 *symbols64,
unsigned long nsyms,
char *strings,
unsigned long strsize,
struct dylib_table_of_contents *tocs,
unsigned long ntoc,
struct dylib_module *mods,
struct dylib_module_64 *mods64,
unsigned long nmodtab,
struct dylib_reference *refs,
unsigned long nextrefsyms,
uint32_t *indirectsyms,
unsigned long nindirectsyms)
{
    unsigned long i, j, k, n, inew_syms, save_debug, missing_syms;
    unsigned long missing_symbols;
    char *p, *q, **pp, *basename;
    struct symbol_list *sp;
    unsigned long new_ext_strsize, len, *changes, inew_undefsyms;
    unsigned char nsects;
    struct load_command *lc;
    struct segment_command *sg;
    struct segment_command_64 *sg64;
    struct section *s, **sections;
    struct section_64 *s64, **sections64;
    uint32_t ncmds, mh_flags, s_flags, n_strx;
    struct nlist *sym;
    struct undef_map *undef_map;
    struct undef_map64 *undef_map64;
    uint8_t n_type, n_sect;
    uint16_t n_desc;
    uint64_t n_value;
    uint32_t module_name, iextdefsym, nextdefsym, ilocalsym, nlocalsym;
    uint32_t irefsym, nrefsym;
    unsigned char text_nsect;

	save_debug = 0;
	if(saves != NULL)
	    free(saves);
	saves = (long *)allocate(nsyms * sizeof(long));
	bzero(saves, nsyms * sizeof(long));
	changes = NULL;
	for(i = 0; i < nsave_symbols; i++)
	    save_symbols[i].sym = NULL;
	for(i = 0; i < nremove_symbols; i++)
	    remove_symbols[i].sym = NULL;
	if(member == NULL){
	    for(i = 0; i < nsave_symbols; i++)
		save_symbols[i].seen = FALSE;
	    for(i = 0; i < nremove_symbols; i++)
		remove_symbols[i].seen = FALSE;
	}

	new_nsyms = 0;
	new_strsize = sizeof(long);
	new_nlocalsym = 0;
	new_nextdefsym = 0;
	new_nundefsym = 0;
	new_ext_strsize = 0;

	/*
	 * Gather an array of section struct pointers so we can later determine
	 * if we run into a global symbol in a coalesced section and not strip
	 * those symbols.
	 * statics.
	 */
	nsects = 0;
	text_nsect = NO_SECT;
	lc = object->load_commands;
	if(object->mh != NULL)
	    ncmds = object->mh->ncmds;
	else
	    ncmds = object->mh64->ncmds;
	for(i = 0; i < ncmds; i++){
	    if(lc->cmd == LC_SEGMENT){
		sg = (struct segment_command *)lc;
		nsects += sg->nsects;
	    }
	    else if(lc->cmd == LC_SEGMENT_64){
		sg64 = (struct segment_command_64 *)lc;
		nsects += sg64->nsects;
	    }
	    lc = (struct load_command *)((char *)lc + lc->cmdsize);
	}
	if(object->mh != NULL){
	    sections = allocate(nsects * sizeof(struct section *));
	    sections64 = NULL;
	}
	else{
	    sections = NULL;
	    sections64 = allocate(nsects * sizeof(struct section_64 *));
	}
	nsects = 0;
	lc = object->load_commands;
	for(i = 0; i < ncmds; i++){
	    if(lc->cmd == LC_SEGMENT){
		sg = (struct segment_command *)lc;
		s = (struct section *)((char *)sg +
					sizeof(struct segment_command));
		for(j = 0; j < sg->nsects; j++){
		    if(strcmp((s + j)->sectname, SECT_TEXT) == 0 &&
		       strcmp((s + j)->segname, SEG_TEXT) == 0)
			text_nsect = nsects + 1;
		    sections[nsects++] = s++;
		}
	    }
	    else if(lc->cmd == LC_SEGMENT_64){
		sg64 = (struct segment_command_64 *)lc;
		s64 = (struct section_64 *)((char *)sg64 +
					sizeof(struct segment_command_64));
		for(j = 0; j < sg64->nsects; j++){
		    if(strcmp((s64 + j)->sectname, SECT_TEXT) == 0 &&
		       strcmp((s64 + j)->segname, SEG_TEXT) == 0)
			text_nsect = nsects + 1;
		    sections64[nsects++] = s64++;
		}
	    }
	    lc = (struct load_command *)((char *)lc + lc->cmdsize);
	}

	for(i = 0; i < nsyms; i++){
	    s_flags = 0;
	    if(object->mh != NULL){
		mh_flags = object->mh->flags;
		n_strx = symbols[i].n_un.n_strx;
		n_type = symbols[i].n_type;
		n_sect = symbols[i].n_sect;
		if((n_type & N_TYPE) == N_SECT){
		    if(n_sect == 0 || n_sect > nsects){
			error_arch(arch, member, "bad n_sect for symbol "
				   "table entry %ld in: ", i);
			return(FALSE);
		    }
		    s_flags = sections[n_sect - 1]->flags;
		}
		n_desc = symbols[i].n_desc;
		n_value = symbols[i].n_value;
	    }
	    else{
		mh_flags = object->mh64->flags;
		n_strx = symbols64[i].n_un.n_strx;
		n_type = symbols64[i].n_type;
		n_sect = symbols64[i].n_sect;
		if((n_type & N_TYPE) == N_SECT){
		    if(n_sect == 0 || n_sect > nsects){
			error_arch(arch, member, "bad n_sect for symbol "
				   "table entry %ld in: ", i);
			return(FALSE);
		    }
		    s_flags = sections64[n_sect - 1]->flags;
		}
		n_desc = symbols64[i].n_desc;
		n_value = symbols64[i].n_value;
	    }
	    if(n_strx != 0){
		if(n_strx > strsize){
		    error_arch(arch, member, "bad string index for symbol "
			       "table entry %ld in: ", i);
		    return(FALSE);
		}
	    }
	    if((n_type & N_TYPE) == N_INDR){
		if(n_value != 0){
		    if(n_value > strsize){
			error_arch(arch, member, "bad string index for "
				   "indirect symbol table entry %ld in: ", i);
			return(FALSE);
		    }
		}
	    }
	    if((n_type & N_EXT) == 0){ /* local symbol */
		if(aflag){
		    if(n_strx != 0)
			new_strsize += strlen(strings + n_strx) + 1;
		    new_nlocalsym++;
		    new_nsyms++;
		    saves[i] = new_nsyms;
		}
		/*
		 * strip -x, -X, or -t on an x86_64 .o file should do nothing.
		 */
		else if(object->mh == NULL && 
		   object->mh64->cputype == CPU_TYPE_X86_64 &&
		   object->mh64->filetype == MH_OBJECT &&
		   (xflag == 1 || Xflag == 1 || tflag == 1)){
		    if(n_strx != 0)
			new_strsize += strlen(strings + n_strx) + 1;
		    new_nlocalsym++;
		    new_nsyms++;
		    saves[i] = new_nsyms;
		}
		/*
		 * The cases a local symbol might be saved are with -X, -S, -t,
		 * or with -d filename.
		 */
		else if((!strip_all && (Xflag || tflag || Sflag)) || dfile){
		    if(n_type & N_STAB){ /* debug symbol */
			if(dfile && n_type == N_SO){
			    if(n_strx != 0){
				basename = strrchr(strings + n_strx, '/');
				if(basename != NULL)
				    basename++;
				else
				    basename = strings + n_strx;
				pp = bsearch(basename, debug_filenames,
					    ndebug_filenames, sizeof(char *),
			 		    (int (*)(const void *, const void *)
					    )cmp_bsearch_filename);
				/*
				 * Save the bracketing N_SO. For each N_SO that
				 * has a filename there is an N_SO that has a
				 * name of "" which ends the stabs for that file
				 */
				if(*basename != '\0'){
				    if(pp != NULL)
					save_debug = 1;
				    else
					save_debug = 0;
				}
				else{
				    /*
				     * This is a bracketing SO so if we are
				     * currently saving debug symbols save this
				     * last one and turn off saving debug syms.
				     */
				    if(save_debug){
					if(n_strx != 0)
					    new_strsize += strlen(strings +
						  	          n_strx) + 1;
					new_nlocalsym++;
					new_nsyms++;
					saves[i] = new_nsyms;
				    }
				    save_debug = 0;
				}
			    }
			    else{
				save_debug = 0;
			    }
			}
			if(saves[i] == 0 && (!Sflag || save_debug)){
			    if(n_strx != 0)
				new_strsize += strlen(strings + n_strx) + 1;
			    new_nlocalsym++;
			    new_nsyms++;
			    saves[i] = new_nsyms;
			}
		    }
		    else{ /* non-debug local symbol */
			if(xflag == 0 && (Sflag || Xflag || tflag)){
			    /*
			     * No -x (strip all local), and one of -S (strip
			     * debug), -X (strip 'L' local), or -t (strip
			     * local except non-'L' text) was given.
			     */
			    if((Xflag && n_strx != 0 &&
			        strings[n_strx] != 'L') ||
			       (tflag && (n_type & N_TYPE) == N_SECT &&
			        n_sect == text_nsect && n_strx != 0 &&
			        strings[n_strx] != 'L') ||
			       (Sflag && !Xflag && !tflag)) {
				/*
				 * If this file is a for the dynamic linker and
				 * this symbol is in a section marked so that
				 * static symbols are stripped then don't
				 * keep this symbol.
				 */
				if((mh_flags & MH_DYLDLINK) != MH_DYLDLINK ||
				   (n_type & N_TYPE) != N_SECT ||
			   	   (s_flags & S_ATTR_STRIP_STATIC_SYMS) != 
					      S_ATTR_STRIP_STATIC_SYMS){
				    new_strsize += strlen(strings + n_strx) + 1;
				    new_nlocalsym++;
				    new_nsyms++;
				    saves[i] = new_nsyms;
				}
			    }
			}
			/*
			 * Treat a local symbol that was a private extern as if
			 * were global if it is referenced by a module and save
			 * it.
			 */
			if((n_type & N_PEXT) == N_PEXT){
			    if(saves[i] == 0 &&
			       private_extern_reference_by_module(
				i, refs ,nextrefsyms) == TRUE){
				if(n_strx != 0)
				    new_strsize += strlen(strings + n_strx) + 1;
				new_nlocalsym++;
				new_nsyms++;
				saves[i] = new_nsyms;
			    }
			    /*
			     * We need to save symbols that were private externs
			     * that are used with indirect symbols.
			     */
			    if(saves[i] == 0 &&
			       symbol_pointer_used(i, indirectsyms,
						   nindirectsyms) == TRUE){
				if(n_strx != 0){
				    len = strlen(strings + n_strx) + 1;
				    new_strsize += len;
				}
				new_nlocalsym++;
				new_nsyms++;
				saves[i] = new_nsyms;
			    }
			}
		    }
		}
		/*
		 * Treat a local symbol that was a private extern as if were
		 * global if it is not referenced by a module.
		 */
		else if((n_type & N_PEXT) == N_PEXT){
		    if(saves[i] == 0 && sfile){
			sp = bsearch(strings + n_strx,
				     save_symbols, nsave_symbols,
				     sizeof(struct symbol_list),
				     (int (*)(const void *, const void *))
					symbol_list_bsearch);
			if(sp != NULL){
			    if(sp->sym == NULL){
				if(object->mh != NULL)
				    sp->sym = &(symbols[i]);
				else
				    sp->sym = &(symbols64[i]);
				sp->seen = TRUE;
			    }
			    if(n_strx != 0)
				new_strsize += strlen(strings + n_strx) + 1;
			    new_nlocalsym++;
			    new_nsyms++;
			    saves[i] = new_nsyms;
			}
		    }
		    if(saves[i] == 0 &&
		       private_extern_reference_by_module(
			i, refs ,nextrefsyms) == TRUE){
			if(n_strx != 0)
			    new_strsize += strlen(strings + n_strx) + 1;
			new_nlocalsym++;
			new_nsyms++;
			saves[i] = new_nsyms;
		    }
		    /*
		     * We need to save symbols that were private externs that
		     * are used with indirect symbols.
		     */
		    if(saves[i] == 0 &&
		       symbol_pointer_used(i, indirectsyms, nindirectsyms) ==
									TRUE){
			if(n_strx != 0){
			    len = strlen(strings + n_strx) + 1;
			    new_strsize += len;
			}
			new_nlocalsym++;
			new_nsyms++;
			saves[i] = new_nsyms;
		    }
		}
	    }
	    else{ /* global symbol */
		/*
		 * strip -R on an x86_64 .o file should do nothing.
		 */
		if(Rfile &&
		   (object->mh != NULL ||
		    object->mh64->cputype != CPU_TYPE_X86_64 ||
		    object->mh64->filetype != MH_OBJECT)){
		    sp = bsearch(strings + n_strx,
				 remove_symbols, nremove_symbols,
				 sizeof(struct symbol_list),
				 (int (*)(const void *, const void *))
				    symbol_list_bsearch);
		    if(sp != NULL){
			if((n_type & N_TYPE) == N_UNDF ||
			   (n_type & N_TYPE) == N_PBUD){
			    error_arch(arch, member, "symbol: %s undefined"
				       " and can't be stripped from: ",
				       sp->name);
			}
			else if(sp->sym != NULL){
			    sym = (struct nlist *)sp->sym;
			    if((sym->n_type & N_PEXT) != N_PEXT)
				error_arch(arch, member, "more than one symbol "
					   "for: %s found in: ", sp->name);
			}
			else{
			    if(object->mh != NULL)
				sp->sym = &(symbols[i]);
			    else
				sp->sym = &(symbols64[i]);
			    sp->seen = TRUE;
			}
			if(n_desc & REFERENCED_DYNAMICALLY){
			    error_arch(arch, member, "symbol: %s is dynamically"
				       " referenced and can't be stripped "
				       "from: ", sp->name);
			}
	    		if((n_type & N_TYPE) == N_SECT &&
			   (s_flags & SECTION_TYPE) == S_COALESCED){
			    error_arch(arch, member, "symbol: %s is a global "
				       "coalesced symbol and can't be "
				       "stripped from: ", sp->name);
			}
			/* don't save this symbol */
			continue;
		    }
		}
		if(Aflag && (n_type & N_TYPE) == N_ABS &&
		   (n_value != 0 ||
		   (n_strx != 0 &&
		    strncmp(strings + n_strx,
			    ".objc_class_name_",
			    sizeof(".objc_class_name_") - 1) == 0))){
		    len = strlen(strings + n_strx) + 1;
		    new_strsize += len;
		    new_ext_strsize += len;
		    new_nextdefsym++;
		    new_nsyms++;
		    saves[i] = new_nsyms;
		}
		if(saves[i] == 0 && (uflag || default_dyld_executable) &&
		   ((((n_type & N_TYPE) == N_UNDF) &&
		     n_value == 0) ||
		    (n_type & N_TYPE) == N_PBUD)){
		    if(n_strx != 0){
			len = strlen(strings + n_strx) + 1;
			new_strsize += len;
			new_ext_strsize += len;
		    }
		    new_nundefsym++;
		    new_nsyms++;
		    saves[i] = new_nsyms;
		}
		if(saves[i] == 0 && nflag &&
		   (n_type & N_TYPE) == N_SECT){
		    if(n_strx != 0){
			len = strlen(strings + n_strx) + 1;
			new_strsize += len;
			new_ext_strsize += len;
		    }
		    new_nextdefsym++;
		    new_nsyms++;
		    saves[i] = new_nsyms;
		}
		if(saves[i] == 0 && sfile){
		    sp = bsearch(strings + n_strx,
				 save_symbols, nsave_symbols,
				 sizeof(struct symbol_list),
				 (int (*)(const void *, const void *))
				    symbol_list_bsearch);
		    if(sp != NULL){
			if(sp->sym != NULL){
			    sym = (struct nlist *)sp->sym;
			    if((sym->n_type & N_PEXT) != N_PEXT)
				error_arch(arch, member, "more than one symbol "
					   "for: %s found in: ", sp->name);
			}
			else{
			    if(object->mh != NULL)
				sp->sym = &(symbols[i]);
			    else
				sp->sym = &(symbols64[i]);
			    sp->seen = TRUE;
			    len = strlen(strings + n_strx) + 1;
			    new_strsize += len;
			    new_ext_strsize += len;
			    if((n_type & N_TYPE) == N_UNDF ||
			       (n_type & N_TYPE) == N_PBUD)
				new_nundefsym++;
			    else
				new_nextdefsym++;
			    new_nsyms++;
			    saves[i] = new_nsyms;
			}
		    }
		}
		/*
		 * We only need to save coalesced symbols that are used as
		 * indirect symbols in 32-bit applications.
		 *
		 * In 64-bit applications, we only need to save coalesced
		 * symbols that are used as weak definitions.
		 */
		if(object->mh != NULL &&
		   saves[i] == 0 &&
		   (n_type & N_TYPE) == N_SECT &&
		   (s_flags & SECTION_TYPE) == S_COALESCED &&
		   symbol_pointer_used(i, indirectsyms, nindirectsyms) == TRUE){
		    if(n_strx != 0){
			len = strlen(strings + n_strx) + 1;
			new_strsize += len;
			new_ext_strsize += len;
		    }
		    new_nextdefsym++;
		    new_nsyms++;
		    saves[i] = new_nsyms;
		}
		if(saves[i] == 0 &&
		   (n_type & N_TYPE) == N_SECT &&
		   (n_desc & N_WEAK_DEF) != 0){
		    if(n_strx != 0){
			len = strlen(strings + n_strx) + 1;
			new_strsize += len;
			new_ext_strsize += len;
		    }
		    new_nextdefsym++;
		    new_nsyms++;
		    saves[i] = new_nsyms;
		}
		if(saves[i] == 0 &&
		   ((Xflag || Sflag || xflag || tflag || aflag) ||
		   ((rflag || default_dyld_executable) &&
		    n_desc & REFERENCED_DYNAMICALLY))){
		    len = strlen(strings + n_strx) + 1;
		    new_strsize += len;
		    new_ext_strsize += len;
		    if((n_type & N_TYPE) == N_INDR){
			len = strlen(strings + n_value) + 1;
			new_strsize += len;
			new_ext_strsize += len;
		    }
		    if((n_type & N_TYPE) == N_UNDF ||
		       (n_type & N_TYPE) == N_PBUD)
			new_nundefsym++;
		    else
			new_nextdefsym++;
		    new_nsyms++;
		    saves[i] = new_nsyms;
		}
	    }
	}
	/*
	 * The module table's module names are placed with the external strings.
	 * So size them and add this to the external string size.
	 */
	for(i = 0; i < nmodtab; i++){
	    if(object->mh != NULL)
		module_name = mods[i].module_name;
	    else
		module_name = mods64[i].module_name;
	    if(module_name == 0 || module_name > strsize){
		error_arch(arch, member, "bad string index for module_name "
			   "of module table entry %ld in: ", i);
		return(FALSE);
	    }
	    len = strlen(strings + module_name) + 1;
	    new_strsize += len;
	    new_ext_strsize += len;
	}

	/*
	 * Updating the reference table may require a symbol not yet listed as
	 * as saved to be present in the output file.  If a defined external
	 * symbol is removed and there is a undefined reference to it in the
	 * reference table an undefined symbol needs to be created for it in
	 * the output file.  If this happens the number of new symbols and size
	 * of the new strings are adjusted.  And the array changes[] is set to
	 * map the old symbol index to the new symbol index for the symbol that
	 * is changed to an undefined symbol.
	 */
	missing_symbols = 0;
	if(ref_saves != NULL)
	    free(ref_saves);
	ref_saves = (long *)allocate(nextrefsyms * sizeof(long));
	bzero(ref_saves, nextrefsyms * sizeof(long));
	changes = (unsigned long *)allocate(nsyms * sizeof(long));
	bzero(changes, nsyms * sizeof(long));
	new_nextrefsyms = 0;
	for(i = 0; i < nextrefsyms; i++){
	    if(refs[i].isym > nsyms){
		error_arch(arch, member, "bad symbol table index for "
			   "reference table entry %ld in: ", i);
		return(FALSE);
	    }
	    if(saves[refs[i].isym]){
		new_nextrefsyms++;
		ref_saves[i] = new_nextrefsyms;
	    }
	    else{
		if(refs[i].flags == REFERENCE_FLAG_UNDEFINED_NON_LAZY ||
		   refs[i].flags == REFERENCE_FLAG_UNDEFINED_LAZY){
		    if(changes[refs[i].isym] == 0){
			if(object->mh != NULL)
			    n_strx = symbols[refs[i].isym].n_un.n_strx;
			else
			    n_strx = symbols64[refs[i].isym].n_un.n_strx;
			len = strlen(strings + n_strx) + 1;
			new_strsize += len;
			new_ext_strsize += len;
			new_nundefsym++;
			new_nsyms++;
			changes[refs[i].isym] = new_nsyms;
			new_nextrefsyms++;
			ref_saves[i] = new_nextrefsyms;
		    }
		}
		else{
		    if(refs[i].flags ==
				    REFERENCE_FLAG_PRIVATE_UNDEFINED_NON_LAZY ||
		       refs[i].flags == REFERENCE_FLAG_PRIVATE_UNDEFINED_LAZY){
			if(missing_symbols == 0){
			    error_arch(arch, member, "private extern symbols "
			      "referenced by modules can't be stripped in: ");
			    missing_symbols = 1;
			}
			if(object->mh != NULL)
			    n_strx = symbols[refs[i].isym].n_un.n_strx;
			else
			    n_strx = symbols64[refs[i].isym].n_un.n_strx;
			fprintf(stderr, "%s\n", strings + n_strx);
			saves[refs[i].isym] = -1;
		    }
		}
	    }
	}
	if(missing_symbols == 1)
	    return(FALSE);

	if(member == NULL){
	    missing_syms = 0;
	    if(iflag == 0){
		for(i = 0; i < nsave_symbols; i++){
		    if(save_symbols[i].sym == NULL){
			if(missing_syms == 0){
			    error_arch(arch, member, "symbols names listed "
				       "in: %s not in: ", sfile);
			    missing_syms = 1;
			}
			fprintf(stderr, "%s\n", save_symbols[i].name);
		    }
		}
	    }
	    missing_syms = 0;
	    /*
	     * strip -R on an x86_64 .o file should do nothing.
	     */
	    if(iflag == 0 &&
	       (object->mh != NULL ||
		object->mh64->cputype != CPU_TYPE_X86_64 ||
		object->mh64->filetype != MH_OBJECT)){
		for(i = 0; i < nremove_symbols; i++){
		    if(remove_symbols[i].sym == NULL){
			if(missing_syms == 0){
			    error_arch(arch, member, "symbols names listed "
				       "in: %s not in: ", Rfile);
			    missing_syms = 1;
			}
			fprintf(stderr, "%s\n", remove_symbols[i].name);
		    }
		}
	    }
	}

	if(object->mh != NULL){
	    new_symbols = (struct nlist *)
			  allocate(new_nsyms * sizeof(struct nlist));
	    new_symbols64 = NULL;
	}
	else{
	    new_symbols = NULL;
	    new_symbols64 = (struct nlist_64 *)
			  allocate(new_nsyms * sizeof(struct nlist_64));
	}
	new_strsize = round(new_strsize, sizeof(long));
	new_strings = (char *)allocate(new_strsize);
	new_strings[new_strsize - 3] = '\0';
	new_strings[new_strsize - 2] = '\0';
	new_strings[new_strsize - 1] = '\0';

	memset(new_strings, '\0', sizeof(long));
	p = new_strings + sizeof(long);
	q = p + new_ext_strsize;

	/* if all strings were stripped set the size to zero */
	if(new_strsize == sizeof(long))
	    new_strsize = 0;

	/*
	 * Now create a symbol table and string table in this order
	 * symbol table
	 *	local symbols
	 *	external defined symbols
	 *	undefined symbols
	 * string table
	 *	external strings
	 *	local strings
	 */
	inew_syms = 0;
	for(i = 0; i < nsyms; i++){
	    if(saves[i]){
		if(object->mh != NULL){
		    n_strx = symbols[i].n_un.n_strx;
		    n_type = symbols[i].n_type;
		}
		else{
		    n_strx = symbols64[i].n_un.n_strx;
		    n_type = symbols64[i].n_type;
		}
		if((n_type & N_EXT) == 0){
		    if(object->mh != NULL)
			new_symbols[inew_syms] = symbols[i];
		    else
			new_symbols64[inew_syms] = symbols64[i];
		    if(n_strx != 0){
			strcpy(q, strings + n_strx);
			if(object->mh != NULL)
			    new_symbols[inew_syms].n_un.n_strx =
				q - new_strings;
			else
			    new_symbols64[inew_syms].n_un.n_strx =
				q - new_strings;
			q += strlen(q) + 1;
		    }
		    inew_syms++;
		    saves[i] = inew_syms;
		}
	    }
	}
	for(i = 0; i < nsyms; i++){
	    if(saves[i]){
		if(object->mh != NULL){
		    n_strx = symbols[i].n_un.n_strx;
		    n_type = symbols[i].n_type;
		    n_value = symbols[i].n_value;
		}
		else{
		    n_strx = symbols64[i].n_un.n_strx;
		    n_type = symbols64[i].n_type;
		    n_value = symbols64[i].n_value;
		}
		if((n_type & N_EXT) == N_EXT &&
		   ((n_type & N_TYPE) != N_UNDF &&
		    (n_type & N_TYPE) != N_PBUD)){
		    if(object->mh != NULL)
			new_symbols[inew_syms] = symbols[i];
		    else
			new_symbols64[inew_syms] = symbols64[i];
		    if(n_strx != 0){
			strcpy(p, strings + n_strx);
			if(object->mh != NULL)
			    new_symbols[inew_syms].n_un.n_strx =
				p - new_strings;
			else
			    new_symbols64[inew_syms].n_un.n_strx =
				p - new_strings;
			p += strlen(p) + 1;
		    }
		    if((n_type & N_TYPE) == N_INDR){
			if(n_value != 0){
			    strcpy(p, strings + n_value);
			    if(object->mh != NULL)
				new_symbols[inew_syms].n_value =
				    p - new_strings;
			    else
				new_symbols64[inew_syms].n_value =
				    p - new_strings;
			    p += strlen(p) + 1;
			}
		    }
		    inew_syms++;
		    saves[i] = inew_syms;
		}
	    }
	}
	/*
	 * Build the new undefined symbols into a map and sort it.
	 */
	inew_undefsyms = 0;
	if(object->mh != NULL){
	    undef_map = (struct undef_map *)allocate(new_nundefsym *
						     sizeof(struct undef_map));
	    undef_map64 = NULL;
	}
	else{
	    undef_map = NULL;
	    undef_map64 = (struct undef_map64 *)allocate(new_nundefsym *
						sizeof(struct undef_map64));
	}
	for(i = 0; i < nsyms; i++){
	    if(saves[i]){
		if(object->mh != NULL){
		    n_strx = symbols[i].n_un.n_strx;
		    n_type = symbols[i].n_type;
		}
		else{
		    n_strx = symbols64[i].n_un.n_strx;
		    n_type = symbols64[i].n_type;
		}
		if((n_type & N_EXT) == N_EXT &&
		   ((n_type & N_TYPE) == N_UNDF ||
		    (n_type & N_TYPE) == N_PBUD)){
		    if(object->mh != NULL)
			undef_map[inew_undefsyms].symbol = symbols[i];
		    else
			undef_map64[inew_undefsyms].symbol64 = symbols64[i];
		    if(n_strx != 0){
			strcpy(p, strings + n_strx);
			if(object->mh != NULL)
			    undef_map[inew_undefsyms].symbol.n_un.n_strx =
				p - new_strings;
			else
			    undef_map64[inew_undefsyms].symbol64.n_un.n_strx =
				p - new_strings;
			p += strlen(p) + 1;
		    }
		    if(object->mh != NULL)
			undef_map[inew_undefsyms].index = i;
		    else
			undef_map64[inew_undefsyms].index = i;
		    inew_undefsyms++;
		}
	    }
	}
	for(i = 0; i < nsyms; i++){
	    if(changes[i]){
		if(object->mh != NULL)
		    n_strx = symbols[i].n_un.n_strx;
		else
		    n_strx = symbols64[i].n_un.n_strx;
		if(n_strx != 0){
		    strcpy(p, strings + n_strx);
		    if(object->mh != NULL)
			undef_map[inew_undefsyms].symbol.n_un.n_strx =
			    p - new_strings;
		    else
			undef_map64[inew_undefsyms].symbol64.n_un.n_strx =
			    p - new_strings;
		    p += strlen(p) + 1;
		}
		if(object->mh != NULL){
		    undef_map[inew_undefsyms].symbol.n_type = N_UNDF | N_EXT;
		    undef_map[inew_undefsyms].symbol.n_sect = NO_SECT;
		    undef_map[inew_undefsyms].symbol.n_desc = 0;
		    undef_map[inew_undefsyms].symbol.n_value = 0;
		    undef_map[inew_undefsyms].index = i;
		}
		else{
		    undef_map64[inew_undefsyms].symbol64.n_type = N_UNDF |N_EXT;
		    undef_map64[inew_undefsyms].symbol64.n_sect = NO_SECT;
		    undef_map64[inew_undefsyms].symbol64.n_desc = 0;
		    undef_map64[inew_undefsyms].symbol64.n_value = 0;
		    undef_map64[inew_undefsyms].index = i;
		}
		inew_undefsyms++;
	    }
	}
	/* Sort the undefined symbols by name */
	qsort_strings = new_strings;
	if(object->mh != NULL)
	    qsort(undef_map, new_nundefsym, sizeof(struct undef_map),
		  (int (*)(const void *, const void *))cmp_qsort_undef_map);
	else
	    qsort(undef_map64, new_nundefsym, sizeof(struct undef_map64),
		  (int (*)(const void *, const void *))cmp_qsort_undef_map_64);
	/* Copy the symbols now in sorted order into new_symbols */
	for(i = 0; i < new_nundefsym; i++){
	    if(object->mh != NULL){
		new_symbols[inew_syms] = undef_map[i].symbol;
		inew_syms++;
		saves[undef_map[i].index] = inew_syms;
	    }
	    else{
		new_symbols64[inew_syms] = undef_map64[i].symbol64;
		inew_syms++;
		saves[undef_map64[i].index] = inew_syms;
	    }
	}

	/*
	 * Fixup the module table's module name strings adding them to the
	 * string table.  Also fix the indexes into the symbol table for
	 * external and local symbols.  And fix up the indexes into the
	 * reference table.
	 */
	for(i = 0; i < nmodtab; i++){
	    if(object->mh != NULL){
		strcpy(p, strings + mods[i].module_name);
		mods[i].module_name = p - new_strings;
		iextdefsym = mods[i].iextdefsym;
		nextdefsym = mods[i].nextdefsym;
		ilocalsym = mods[i].ilocalsym;
		nlocalsym = mods[i].nlocalsym;
		irefsym = mods[i].irefsym;
		nrefsym = mods[i].nrefsym;
	    }
	    else{
		strcpy(p, strings + mods64[i].module_name);
		mods64[i].module_name = p - new_strings;
		iextdefsym = mods64[i].iextdefsym;
		nextdefsym = mods64[i].nextdefsym;
		ilocalsym = mods64[i].ilocalsym;
		nlocalsym = mods64[i].nlocalsym;
		irefsym = mods64[i].irefsym;
		nrefsym = mods64[i].nrefsym;
	    }
	    p += strlen(p) + 1;

	    if(iextdefsym > nsyms){
		error_arch(arch, member, "bad index into externally defined "
		    "symbols of module table entry %ld in: ", i);
		return(FALSE);
	    }
	    if(iextdefsym + nextdefsym > nsyms){
		error_arch(arch, member, "bad number of externally defined "
		    "symbols of module table entry %ld in: ", i);
		return(FALSE);
	    }
	    for(j = iextdefsym; j < iextdefsym + nextdefsym; j++){
		if(saves[j] != 0 && changes[j] == 0)
		    break;
	    }
	    n = 0;
	    for(k = j; k < iextdefsym + nextdefsym; k++){
		if(saves[k] != 0 && changes[k] == 0)
		    n++;
	    }
	    if(n == 0){
		if(object->mh != NULL){
		    mods[i].iextdefsym = 0;
		    mods[i].nextdefsym = 0;
		}
		else{
		    mods64[i].iextdefsym = 0;
		    mods64[i].nextdefsym = 0;
		}
	    }
	    else{
		if(object->mh != NULL){
		    mods[i].iextdefsym = saves[j] - 1;
		    mods[i].nextdefsym = n;
		}
		else{
		    mods64[i].iextdefsym = saves[j] - 1;
		    mods64[i].nextdefsym = n;
		}
	    }

	    if(ilocalsym > nsyms){
		error_arch(arch, member, "bad index into symbols for local "
		    "symbols of module table entry %ld in: ", i);
		return(FALSE);
	    }
	    if(ilocalsym + nlocalsym > nsyms){
		error_arch(arch, member, "bad number of local "
		    "symbols of module table entry %ld in: ", i);
		return(FALSE);
	    }
	    for(j = ilocalsym; j < ilocalsym + nlocalsym; j++){
		if(saves[j] != 0)
		    break;
	    }
	    n = 0;
	    for(k = j; k < ilocalsym + nlocalsym; k++){
		if(saves[k] != 0)
		    n++;
	    }
	    if(n == 0){
		if(object->mh != NULL){
		    mods[i].ilocalsym = 0;
		    mods[i].nlocalsym = 0;
		}
		else{
		    mods64[i].ilocalsym = 0;
		    mods64[i].nlocalsym = 0;
		}
	    }
	    else{
		if(object->mh != NULL){
		    mods[i].ilocalsym = saves[j] - 1;
		    mods[i].nlocalsym = n;
		}
		else{
		    mods64[i].ilocalsym = saves[j] - 1;
		    mods64[i].nlocalsym = n;
		}
	    }

	    if(irefsym > nextrefsyms){
		error_arch(arch, member, "bad index into reference table "
		    "of module table entry %ld in: ", i);
		return(FALSE);
	    }
	    if(irefsym + nrefsym > nextrefsyms){
		error_arch(arch, member, "bad number of reference table "
		    "entries of module table entry %ld in: ", i);
		return(FALSE);
	    }
	    for(j = irefsym; j < irefsym + nrefsym; j++){
		if(ref_saves[j] != 0)
		    break;
	    }
	    n = 0;
	    for(k = j; k < irefsym + nrefsym; k++){
		if(ref_saves[k] != 0)
		    n++;
	    }
	    if(n == 0){
		if(object->mh != NULL){
		    mods[i].irefsym = 0;
		    mods[i].nrefsym = 0;
		}
		else{
		    mods64[i].irefsym = 0;
		    mods64[i].nrefsym = 0;
		}
	    }
	    else{
		if(object->mh != NULL){
		    mods[i].irefsym = ref_saves[j] - 1;
		    mods[i].nrefsym = n;
		}
		else{
		    mods64[i].irefsym = ref_saves[j] - 1;
		    mods64[i].nrefsym = n;
		}
	    }
	}

	/*
	 * Create a new reference table.
	 */
	new_refs = allocate(new_nextrefsyms * sizeof(struct dylib_reference));
	j = 0;
	for(i = 0; i < nextrefsyms; i++){
	    if(ref_saves[i]){
		if(saves[refs[i].isym]){
		    new_refs[j].isym = saves[refs[i].isym] - 1;
		    new_refs[j].flags = refs[i].flags;
		}
		else{
		    if(refs[i].flags == REFERENCE_FLAG_UNDEFINED_NON_LAZY ||
		       refs[i].flags == REFERENCE_FLAG_UNDEFINED_LAZY){
			new_refs[j].isym = changes[refs[i].isym] - 1;
			new_refs[j].flags = refs[i].flags;
		    }
		}
		j++;
	    }
	}

	/*
	 * Create a new dylib table of contents.
	 */
	new_ntoc = 0;
	for(i = 0; i < ntoc; i++){
	    if(tocs[i].symbol_index >= nsyms){
		error_arch(arch, member, "bad symbol index for table of "
		    "contents table entry %ld in: ", i);
		return(FALSE);
	    }
	    if(saves[tocs[i].symbol_index] != 0 &&
	       changes[tocs[i].symbol_index] == 0)
		new_ntoc++;
	}
	new_tocs = allocate(new_ntoc * sizeof(struct dylib_table_of_contents));
	j = 0;
	for(i = 0; i < ntoc; i++){
	    if(saves[tocs[i].symbol_index] != 0 &&
	       changes[tocs[i].symbol_index] == 0){
		new_tocs[j].symbol_index = saves[tocs[i].symbol_index] - 1;
		new_tocs[j].module_index = tocs[i].module_index;
		j++;
	    }
	}

	if(undef_map != NULL)
	    free(undef_map);
	if(undef_map64 != NULL)
	    free(undef_map64);
	if(changes != NULL)
	    free(changes);
	if(sections != NULL)
	    free(sections);
	if(sections64 != NULL)
	    free(sections64);

	if(errors == 0)
	    return(TRUE);
	else
	    return(FALSE);
}

/*
 * strip_LC_UUID_commands() is called when -no_uuid is specified to remove any
 * LC_UUID load commands from the object's load commands.
 */
static
void
strip_LC_UUID_commands(
struct arch *arch,
struct member *member,
struct object *object)
{
    uint32_t i, ncmds, nuuids, mh_sizeofcmds, sizeofcmds;
    struct load_command *lc1, *lc2, *new_load_commands;
    struct segment_command *sg;

	/*
	 * See if there are any LC_UUID load commands.
	 */
	nuuids = 0;
	lc1 = arch->object->load_commands;
        if(arch->object->mh != NULL){
            ncmds = arch->object->mh->ncmds;
	    mh_sizeofcmds = arch->object->mh->sizeofcmds;
	}
	else{
            ncmds = arch->object->mh64->ncmds;
	    mh_sizeofcmds = arch->object->mh64->sizeofcmds;
	}
	for(i = 0; i < ncmds; i++){
	    if(lc1->cmd == LC_UUID){
		nuuids++;
	    }
	    lc1 = (struct load_command *)((char *)lc1 + lc1->cmdsize);
	}
	/* if no LC_UUID load commands just return */
	if(nuuids == 0)
	    return;

	/*
	 * Allocate space for the new load commands as zero it out so any holes
	 * will be zero bytes.
	 */
	new_load_commands = allocate(mh_sizeofcmds);
	memset(new_load_commands, '\0', mh_sizeofcmds);

	/*
	 * Copy all the load commands except the LC_UUID load commands into the
	 * allocated space for the new load commands.
	 */
	lc1 = arch->object->load_commands;
	lc2 = new_load_commands;
	sizeofcmds = 0;
	for(i = 0; i < ncmds; i++){
	    if(lc1->cmd != LC_UUID){
		memcpy(lc2, lc1, lc1->cmdsize);
		sizeofcmds += lc2->cmdsize;
		lc2 = (struct load_command *)((char *)lc2 + lc2->cmdsize);
	    }
	    lc1 = (struct load_command *)((char *)lc1 + lc1->cmdsize);
	}

	/*
	 * Finally copy the updated load commands over the existing load
	 * commands.
	 */
	memcpy(arch->object->load_commands, new_load_commands, sizeofcmds);
	if(mh_sizeofcmds > sizeofcmds){
		memset((char *)arch->object->load_commands + sizeofcmds, '\0', 
			   (mh_sizeofcmds - sizeofcmds));
	}
	ncmds -= nuuids;
        if(arch->object->mh != NULL) {
            arch->object->mh->sizeofcmds = sizeofcmds;
            arch->object->mh->ncmds = ncmds;
        } else {
            arch->object->mh64->sizeofcmds = sizeofcmds;
            arch->object->mh64->ncmds = ncmds;
        }
	free(new_load_commands);

	/* reset the pointers into the load commands */
	lc1 = arch->object->load_commands;
	for(i = 0; i < ncmds; i++){
	    switch(lc1->cmd){
	    case LC_SYMTAB:
		arch->object->st = (struct symtab_command *)lc1;
	        break;
	    case LC_DYSYMTAB:
		arch->object->dyst = (struct dysymtab_command *)lc1;
		break;
	    case LC_TWOLEVEL_HINTS:
		arch->object->hints_cmd = (struct twolevel_hints_command *)lc1;
		break;
	    case LC_PREBIND_CKSUM:
		arch->object->cs = (struct prebind_cksum_command *)lc1;
		break;
	    case LC_SEGMENT:
		sg = (struct segment_command *)lc1;
		if(strcmp(sg->segname, SEG_LINKEDIT) == 0)
		    arch->object->seg_linkedit = sg;
		break;
	    case LC_SEGMENT_SPLIT_INFO:
		object->split_info_cmd = (struct linkedit_data_command *)lc1;
		break;
	    case LC_CODE_SIGNATURE:
		object->code_sig_cmd = (struct linkedit_data_command *)lc1;
		break;
	    }
	    lc1 = (struct load_command *)((char *)lc1 + lc1->cmdsize);
	}
}

#ifndef NMEDIT
/*
 * strip_LC_CODE_SIGNATURE_commands() is called when -c is specified to remove
 * any LC_CODE_SIGNATURE load commands from the object's load commands.
 */
static
void
strip_LC_CODE_SIGNATURE_commands(
struct arch *arch,
struct member *member,
struct object *object)
{
    uint32_t i, ncmds, mh_sizeofcmds, sizeofcmds;
    struct load_command *lc1, *lc2, *new_load_commands;
    struct segment_command *sg;

	/*
	 * See if there is an LC_CODE_SIGNATURE load command and if no command
	 * just return.
	 */
	if(object->code_sig_cmd == NULL)
	    return;

	/*
	 * Allocate space for the new load commands and zero it out so any holes
	 * will be zero bytes.
	 */
        if(arch->object->mh != NULL){
            ncmds = arch->object->mh->ncmds;
	    mh_sizeofcmds = arch->object->mh->sizeofcmds;
	}
	else{
            ncmds = arch->object->mh64->ncmds;
	    mh_sizeofcmds = arch->object->mh64->sizeofcmds;
	}
	new_load_commands = allocate(mh_sizeofcmds);
	memset(new_load_commands, '\0', mh_sizeofcmds);

	/*
	 * Copy all the load commands except the LC_CODE_SIGNATURE load commands
	 * into the allocated space for the new load commands.
	 */
	lc1 = arch->object->load_commands;
	lc2 = new_load_commands;
	sizeofcmds = 0;
	for(i = 0; i < ncmds; i++){
	    if(lc1->cmd != LC_CODE_SIGNATURE){
		memcpy(lc2, lc1, lc1->cmdsize);
		sizeofcmds += lc2->cmdsize;
		lc2 = (struct load_command *)((char *)lc2 + lc2->cmdsize);
	    }
	    lc1 = (struct load_command *)((char *)lc1 + lc1->cmdsize);
	}

	/*
	 * Finally copy the updated load commands over the existing load
	 * commands.
	 */
	memcpy(arch->object->load_commands, new_load_commands, sizeofcmds);
	if(mh_sizeofcmds > sizeofcmds){
		memset((char *)arch->object->load_commands + sizeofcmds, '\0', 
			   (mh_sizeofcmds - sizeofcmds));
	}
	ncmds -= 1;
        if(arch->object->mh != NULL) {
            arch->object->mh->sizeofcmds = sizeofcmds;
            arch->object->mh->ncmds = ncmds;
        } else {
            arch->object->mh64->sizeofcmds = sizeofcmds;
            arch->object->mh64->ncmds = ncmds;
        }
	free(new_load_commands);

	/* reset the pointers into the load commands */
	object->code_sig_cmd = NULL;
	lc1 = arch->object->load_commands;
	for(i = 0; i < ncmds; i++){
	    switch(lc1->cmd){
	    case LC_SYMTAB:
		arch->object->st = (struct symtab_command *)lc1;
	        break;
	    case LC_DYSYMTAB:
		arch->object->dyst = (struct dysymtab_command *)lc1;
		break;
	    case LC_TWOLEVEL_HINTS:
		arch->object->hints_cmd = (struct twolevel_hints_command *)lc1;
		break;
	    case LC_PREBIND_CKSUM:
		arch->object->cs = (struct prebind_cksum_command *)lc1;
		break;
	    case LC_SEGMENT:
		sg = (struct segment_command *)lc1;
		if(strcmp(sg->segname, SEG_LINKEDIT) == 0)
		    arch->object->seg_linkedit = sg;
		break;
	    case LC_SEGMENT_SPLIT_INFO:
		object->split_info_cmd = (struct linkedit_data_command *)lc1;
		break;
	    }
	    lc1 = (struct load_command *)((char *)lc1 + lc1->cmdsize);
	}

	if(cflag){
	    /*
	     * To get the right amount of the file copied out by writeout() for
	     * the case when we are stripping out the section contents we
	     * already reduce the object size by the size of the section
	     * contents including the padding after the load commands.  So here
	     * we need to further reduce it by the load command for the
             * LC_CODE_SIGNATURE (a struct linkedit_data_command) we are
	     * removing.
	     */
	    object->object_size -= sizeof(struct linkedit_data_command);
	    /*
 	     * Then this size minus the size of the input symbolic information
	     * is what is copied out from the file by writeout().  Which in this
	     * case is just the new headers.
	     */

	    /*
	     * Finally for -c the file offset to the link edit information is to
	     * be right after the load commands.  So reset this for the updated
	     * size of the load commands without the LC_CODE_SIGNATURE.
	     */
	    if(object->mh != NULL)
		object->seg_linkedit->fileoff = sizeof(struct mach_header) +
						sizeofcmds;
	    else
		object->seg_linkedit64->fileoff =
			sizeof(struct mach_header_64) + sizeofcmds;
	}
}
#endif /* !(NMEDIT) */

/*
 * private_extern_reference_by_module() is passed a symbol_index of a private
 * extern symbol and the module table.  If the symbol_index appears in the
 * module symbol table this returns TRUE else it returns FALSE.
 */
static
enum bool
private_extern_reference_by_module(
unsigned long symbol_index,
struct dylib_reference *refs,
unsigned long nextrefsyms)
{
    unsigned long i;

	for(i = 0; i < nextrefsyms; i++){
	    if(refs[i].isym == symbol_index){
		if(refs[i].flags == REFERENCE_FLAG_PRIVATE_UNDEFINED_NON_LAZY ||
		   refs[i].flags == REFERENCE_FLAG_PRIVATE_UNDEFINED_LAZY){
		    return(TRUE);
		}
	    }
	}
	return(FALSE);
}

/*
 * symbol_pointer_used() is passed a symbol_index and the indirect table.  If
 * the symbol_index appears in the indirect symbol table this returns TRUE else
 * it returns FALSE.
 */
static
enum bool
symbol_pointer_used(
unsigned long symbol_index,
uint32_t *indirectsyms,
unsigned long nindirectsyms)
{
    unsigned long i;

	for(i = 0; i < nindirectsyms; i++){
	    if(indirectsyms[i] == symbol_index)
		return(TRUE);
	}
	return(FALSE);
}

/*
 * Function for qsort for comparing undefined map entries.
 */
static
int
cmp_qsort_undef_map(
const struct undef_map *sym1,
const struct undef_map *sym2)
{
	return(strcmp(qsort_strings + sym1->symbol.n_un.n_strx,
		      qsort_strings + sym2->symbol.n_un.n_strx));
}

static
int
cmp_qsort_undef_map_64(
const struct undef_map64 *sym1,
const struct undef_map64 *sym2)
{
	return(strcmp(qsort_strings + sym1->symbol64.n_un.n_strx,
		      qsort_strings + sym2->symbol64.n_un.n_strx));
}
#endif /* !defined(NMEDIT) */

#ifndef NMEDIT
/*
 * Function for qsort for comparing object names.
 */
static
int
cmp_qsort_filename(
const char **name1,
const char **name2)
{
	return(strcmp(*name1, *name2));
}

/*
 * Function for bsearch for finding a object name.
 */
static
int
cmp_bsearch_filename(
const char *name1,
const char **name2)
{
	return(strcmp(name1, *name2));
}
#endif /* !defined(NMEDIT) */

#ifdef NMEDIT
static
enum bool
edit_symtab(
struct arch *arch,
struct member *member,
struct object *object,
struct nlist *symbols,
struct nlist_64 *symbols64,
unsigned long nsyms,
char *strings,
unsigned long strsize,
struct dylib_table_of_contents *tocs,
unsigned long ntoc,
struct dylib_module *mods,
struct dylib_module_64 *mods64,
unsigned long nmodtab,
struct dylib_reference *refs,
unsigned long nextrefsyms)
{
    unsigned long i, j, k;
    unsigned char data_n_sect, nsects;
    struct load_command *lc;
    struct segment_command *sg;
    struct segment_command_64 *sg64;
    struct section *s, **sections;
    struct section_64 *s64, **sections64;

    unsigned long missing_syms;
    struct symbol_list *sp;
    struct nlist **global_symbol;
    struct nlist_64 **global_symbol64;
    enum bool global_symbol_found;
    char *global_name, save_char;
    enum bool dwarf_debug_map;
    enum byte_sex host_byte_sex;
    long missing_reloc_symbols;
    enum bool edit_symtab_return;

    char *p, *q;
    unsigned long new_ext_strsize, len, inew_syms;

    struct nlist **changed_globals;
    struct nlist_64 **changed_globals64;
    unsigned long nchanged_globals;
    uint32_t ncmds, s_flags, n_strx, module_name, ilocalsym, nlocalsym;
    uint32_t iextdefsym, nextdefsym;
    uint8_t n_type, n_sect, global_symbol_n_sect;
    uint64_t n_value;
    enum bool warned_about_global_coalesced_symbols;

	edit_symtab_return = TRUE;
	host_byte_sex = get_host_byte_sex();
	missing_reloc_symbols = 0;
	warned_about_global_coalesced_symbols = FALSE;

	if(nmedits != NULL)
	    free(nmedits);
	nmedits = allocate(nsyms * sizeof(enum bool));
	for(i = 0; i < nsyms; i++)
	    nmedits[i] = FALSE;

	/*
	 * If nmedit is operating on a dynamic library then symbols are turned
	 * into private externs with the extern bit off not into static symbols.
	 */
	if(object->mh_filetype == MH_DYLIB && pflag == TRUE){
	    error_arch(arch, member, "can't use -p with dynamic libraries");
	    return(FALSE);
	}

	/*
	 * As part of the MAJOR guess for the second pass to fix stabs for the
	 * globals symbols that get turned into non-global symbols.  We need to
	 * change the stabs.  To do this we to know if a N_GSYM is for a data
	 * symbol or not to know to turn it into an N_STSYM or a N_FUN.
	 * This logic as determined by compiling test cases with and without
	 * the key word 'static' and looking at the difference between the STABS
	 * the compiler generates and trying to match that here.
	 *
	 * We also use this loop and the next to gather an array of section
	 * struct pointers so we can later determine if we run into a global
	 * symbol in a coalesced section and not turn those symbols into
	 * statics.
	 */
	j = 0;
	nsects = 0;
	n_sect = 1;
	data_n_sect = NO_SECT;
	lc = object->load_commands;
	if(object->mh != NULL)
	    ncmds = object->mh->ncmds;
	else
	    ncmds = object->mh64->ncmds;
	for(i = 0; i < ncmds; i++){
	    if(lc->cmd == LC_SEGMENT){
		sg = (struct segment_command *)lc;
		s = (struct section *)((char *)sg +
					sizeof(struct segment_command));
		nsects += sg->nsects;
		for(j = 0; j < sg->nsects; j++){
		    if(strcmp(s->segname, SEG_DATA) == 0 &&
		       strcmp(s->sectname, SECT_DATA) == 0 &&
		       data_n_sect == NO_SECT){
			data_n_sect = n_sect;
			break;
		    }
		    n_sect++;
		    s++;
		}
	    }
	    else if(lc->cmd == LC_SEGMENT_64){
		sg64 = (struct segment_command_64 *)lc;
		s64 = (struct section_64 *)((char *)sg64 +
					sizeof(struct segment_command_64));
		nsects += sg64->nsects;
		for(j = 0; j < sg64->nsects; j++){
		    if(strcmp(s64->segname, SEG_DATA) == 0 &&
		       strcmp(s64->sectname, SECT_DATA) == 0 &&
		       data_n_sect == NO_SECT){
			data_n_sect = n_sect;
			break;
		    }
		    n_sect++;
		    s64++;
		}
	    }
	    lc = (struct load_command *)((char *)lc + lc->cmdsize);
	}
	if(object->mh != NULL){
	    sections = allocate(nsects * sizeof(struct section *));
	    sections64 = NULL;
	}
	else{
	    sections = NULL;
	    sections64 = allocate(nsects * sizeof(struct section_64 *));
	}
	nsects = 0;
	lc = object->load_commands;
	for(i = 0; i < ncmds; i++){
	    if(lc->cmd == LC_SEGMENT){
		sg = (struct segment_command *)lc;
		s = (struct section *)((char *)sg +
					sizeof(struct segment_command));
		for(j = 0; j < sg->nsects; j++){
		    sections[nsects++] = s++;
		}
	    }
	    else if(lc->cmd == LC_SEGMENT_64){
		sg64 = (struct segment_command_64 *)lc;
		s64 = (struct section_64 *)((char *)sg64 +
					sizeof(struct segment_command_64));
		for(j = 0; j < sg64->nsects; j++){
		    sections64[nsects++] = s64++;
		}
	    }
	    lc = (struct load_command *)((char *)lc + lc->cmdsize);
	}

	/*
	 * Zero out the saved symbols so they can be recorded for this file.
	 */
	for(i = 0; i < nsave_symbols; i++)
	    save_symbols[i].sym = NULL;
	for(i = 0; i < nremove_symbols; i++)
	    remove_symbols[i].sym = NULL;
	if(member == NULL){
	    for(i = 0; i < nsave_symbols; i++)
		save_symbols[i].seen = FALSE;
	    for(i = 0; i < nremove_symbols; i++)
		remove_symbols[i].seen = FALSE;
	}

	nchanged_globals = 0;
	if(object->mh != NULL){
	    changed_globals = allocate(nsyms * sizeof(struct nlist *));
	    changed_globals64 = NULL;
	    for(i = 0; i < nsyms; i++)
		changed_globals[i] = NULL;
	}
	else{
	    changed_globals = NULL;
	    changed_globals64 = allocate(nsyms * sizeof(struct nlist_64 *));
	    for(i = 0; i < nsyms; i++)
		changed_globals64[i] = NULL;
	}

	/*
	 * These are the variables for the new symbol table and new string
	 * table.  Since this routine only turns globals into non-globals the
	 * number of symbols does not change.  But the count of local, defined
	 * external symbols does change.
	 */
	new_nsyms = nsyms;
	new_nlocalsym = 0;
	new_nextdefsym = 0;
	new_nundefsym = 0;

	new_strsize = sizeof(long);
	new_ext_strsize = 0;

	/*
	 * First pass: turn the globals symbols into non-global symbols.
	 */
	for(i = 0; i < nsyms; i++){
	    len = 0;
	    s_flags = 0;
	    if(object->mh != NULL){
		n_strx = symbols[i].n_un.n_strx;
		n_type = symbols[i].n_type;
		n_sect = symbols[i].n_sect;
		if((n_type & N_TYPE) == N_SECT)
		    s_flags = sections[n_sect - 1]->flags;
		n_value = symbols[i].n_value;
	    }
	    else{
		n_strx = symbols64[i].n_un.n_strx;
		n_type = symbols64[i].n_type;
		n_sect = symbols64[i].n_sect;
		if((n_type & N_TYPE) == N_SECT)
		    s_flags = sections64[n_sect - 1]->flags;
		n_value = symbols64[i].n_value;
	    }
	    if(n_strx != 0){
		if(n_strx > strsize){
		    error_arch(arch, member, "bad string index for symbol "
			       "table entry %lu in: ", i);
		    return(FALSE);
		}
		len = strlen(strings + n_strx) + 1;
	    }
	    if(n_type & N_EXT){
		if((n_type & N_TYPE) != N_UNDF &&
		   (n_type & N_TYPE) != N_PBUD){
		    if((n_type & N_TYPE) == N_SECT){
			if(n_sect > nsects){
			    error_arch(arch, member, "bad n_sect for symbol "
				       "table entry %lu in: ", i);
			    return(FALSE);
			}
			if(((s_flags & SECTION_TYPE) == S_COALESCED) &&
			   pflag == FALSE &&
			   object->mh_filetype != MH_OBJECT){
			    /* this remains a global defined symbol */
			    if(warned_about_global_coalesced_symbols == FALSE){
				warning_arch(arch, member, "can't make global "
				    "coalesced symbols (like %s) into static "
				    "symbols (use ld(1)'s "
				    "-exported_symbols_list option) in a final "
				    "linked image: ", strings + n_strx);
				warned_about_global_coalesced_symbols = TRUE;
			    }
			    new_nextdefsym++;
			    new_ext_strsize += len;
			    new_strsize += len;
			    sp = bsearch(strings + n_strx,
					 remove_symbols, nremove_symbols,
					 sizeof(struct symbol_list),
					 (int (*)(const void *, const void *))
					    symbol_list_bsearch);
			    if(sp != NULL){
				if(sp->sym != NULL){
				    error_arch(arch, member, "more than one "
					"symbol for: %s found in: ", sp->name);
				    return(FALSE);
				}
				else{
				    if(object->mh != NULL)
					sp->sym = &(symbols[i]);
				    else
					sp->sym = &(symbols64[i]);
				    sp->seen = TRUE;
				    warning_arch(arch, member, "can't make "
					"global coalesced symbol: %s into a "
					"static symbol in: ", sp->name);
				}
			    }
			    /*
			     * In case the user has listed this coalesced
			     * symbol in the save list look for it and mark it
			     * as seen so we don't complain about not seeing it.
			     */
			    sp = bsearch(strings + n_strx,
					 save_symbols, nsave_symbols,
					 sizeof(struct symbol_list),
					 (int (*)(const void *, const void *))
					    symbol_list_bsearch);
			    if(sp != NULL){
				if(sp->sym != NULL){
				    error_arch(arch, member, "more than one "
					"symbol for: %s found in: ", sp->name);
				    return(FALSE);
				}
				else{
				    if(object->mh != NULL)
					sp->sym = &(symbols[i]);
				    else
					sp->sym = &(symbols64[i]);
				    sp->seen = TRUE;
				}
			    }
			    continue; /* leave this symbol unchanged */
			}
		    }
		    sp = bsearch(strings + n_strx,
				 remove_symbols, nremove_symbols,
				 sizeof(struct symbol_list),
				 (int (*)(const void *, const void *))
				    symbol_list_bsearch);
		    if(sp != NULL){
			if(sp->sym != NULL){
			    error_arch(arch, member, "more than one symbol "
				       "for: %s found in: ", sp->name);
			    return(FALSE);
			}
			else{
			    if(object->mh != NULL)
				sp->sym = &(symbols[i]);
			    else
				sp->sym = &(symbols64[i]);
			    sp->seen = TRUE;
			    goto change_symbol;
			}
		    }
		    else{
			/*
			 * If there is no list of saved symbols, then all
			 * symbols will be saved unless listed in the remove
			 * list.
			 */
			if(sfile == NULL){
			    /*
			     * There is no save list, so if there is also no
			     * remove list but the -p flag is specified or it is
			     * a dynamic library then change all symbols.
			     */
			    if((pflag || object->mh_filetype == MH_DYLIB)
			        && nremove_symbols == 0)
				goto change_symbol;
			    /* this remains a global defined symbol */
			    new_nextdefsym++;
			    new_ext_strsize += len;
			    new_strsize += len;
			    continue; /* leave this symbol unchanged */
			}
		    }
		    sp = bsearch(strings + n_strx,
				 save_symbols, nsave_symbols,
				 sizeof(struct symbol_list),
				 (int (*)(const void *, const void *))
				    symbol_list_bsearch);
		    if(sp != NULL){
			if(sp->sym != NULL){
			    error_arch(arch, member, "more than one symbol "
				       "for: %s found in: ", sp->name);
			    return(FALSE);
			}
			else{
			    if(object->mh != NULL)
				sp->sym = &(symbols[i]);
			    else
				sp->sym = &(symbols64[i]);
			    sp->seen = TRUE;
			    /* this remains a global defined symbol */
			    new_nextdefsym++;
			    new_ext_strsize += len;
			    new_strsize += len;
			}
		    }
		    else{
			if(Aflag && n_type == (N_EXT | N_ABS) &&
		            (n_value != 0 ||
		            (n_strx != 0 &&
			     strncmp(strings + n_strx,
				".objc_class_name_",
				sizeof(".objc_class_name_") - 1) == 0))){
			    /* this remains a global defined symbol */
			    new_nextdefsym++;
			    new_ext_strsize += len;
			    new_strsize += len;
			}
			else{
change_symbol:
			    if((n_type & N_TYPE) != N_INDR){
				nmedits[i] = TRUE;
				if(object->mh != NULL)
				    changed_globals[nchanged_globals++] =
					symbols + i;
				else
				    changed_globals64[nchanged_globals++] =
					symbols64 + i;
				if(pflag){
				    /* this remains a global defined symbol */
				    new_nextdefsym++;
				    new_ext_strsize += len;
				    new_strsize += len;
				}
				else{
				    /* this will become a non-global symbol */
				    new_nlocalsym++;
				    new_strsize += len;
				}
			    }
			    else{
				/* this remains a global defined symbol */
				new_nextdefsym++;
				new_ext_strsize += len;
				new_strsize += len;
			    }
			}
		    }
		}
		else{
		    /* this is an undefined symbol */
		    new_nundefsym++;
		    new_ext_strsize += len;
		    new_strsize += len;
		}
	    }
	    else{
		/* this is a local symbol */
		new_nlocalsym++;
		new_strsize += len;
	    }
	}

	/*
	 * The module table's module names are placed with the external
	 * strings. So size them and add this to the external string size.
	 */
	for(i = 0; i < nmodtab; i++){
	    if(object->mh != NULL)
		module_name = mods[i].module_name;
	    else
		module_name = mods64[i].module_name;
	    if(module_name == 0 || module_name > strsize){
		error_arch(arch, member, "bad string index for module_name "
			   "of module table entry %ld in: ", i);
		return(FALSE);
	    }
	    len = strlen(strings + module_name) + 1;
	    new_strsize += len;
	    new_ext_strsize += len;
	}

	/*
	 * Warn about symbols to be saved that were missing.
	 */
	if(member == NULL){
	    missing_syms = 0;
	    if(iflag == 0){
		for(i = 0; i < nsave_symbols; i++){
		    if(save_symbols[i].sym == NULL){
			if(missing_syms == 0){
			    error_arch(arch, member, "symbols names listed "
				       "in: %s not in: ", sfile);
			    missing_syms = 1;
			}
			fprintf(stderr, "%s\n", save_symbols[i].name);
		    }
		}
		for(i = 0; i < nremove_symbols; i++){
		    if(remove_symbols[i].sym == NULL){
			if(missing_syms == 0){
			    error_arch(arch, member, "symbols names listed "
				       "in: %s not in: ", Rfile);
			    missing_syms = 1;
			}
			fprintf(stderr, "%s\n", remove_symbols[i].name);
		    }
		}
	    }
	}

	/*
	 * Second pass: fix stabs for the globals symbols that got turned into
	 * non-global symbols.  This is a MAJOR guess.  The specific changes
	 * to do here were determined by compiling test cases with and without
	 * the key word 'static' and looking at the difference between the STABS
	 * the compiler generates and trying to match that here.
	 */
	global_strings = strings;
	if(object->mh != NULL)
	    qsort(changed_globals, nchanged_globals, sizeof(struct nlist *),
		  (int (*)(const void *, const void *))cmp_qsort_global);
	else
	    qsort(changed_globals64, nchanged_globals,sizeof(struct nlist_64 *),
		  (int (*)(const void *, const void *))cmp_qsort_global_64);
	dwarf_debug_map = FALSE;
	for(i = 0; i < nsyms; i++){
	  uint16_t n_desc;
	    if(object->mh != NULL){
		n_strx = symbols[i].n_un.n_strx;
		n_type = symbols[i].n_type;
		n_desc = symbols[i].n_desc;
	    }
	    else{
		n_strx = symbols64[i].n_un.n_strx;
		n_type = symbols64[i].n_type;
		n_desc = symbols64[i].n_desc;
	    }
	    if(n_type == N_SO)
	      dwarf_debug_map = FALSE;
	    else if (n_type == N_OSO)
	      dwarf_debug_map = n_desc != 0;
	    else if (dwarf_debug_map && n_type == N_GSYM){
	      global_name = strings + n_strx;
	      if(object->mh != NULL){
		global_symbol = bsearch(global_name, changed_globals,
					nchanged_globals,sizeof(struct nlist *),
			     		(int (*)(const void *, const void *))
					cmp_bsearch_global);
		if(global_symbol != NULL){
		  symbols[i].n_type = N_STSYM;
		  symbols[i].n_sect = (*global_symbol)->n_sect;
		  symbols[i].n_value = (*global_symbol)->n_value;
		}
	      }
	      else{
		global_symbol64 = bsearch(global_name, changed_globals64,
					  nchanged_globals,
					  sizeof(struct nlist_64 *),
					  (int (*)(const void *, const void *))
					  cmp_bsearch_global_64);
		if(global_symbol64 != NULL){
		  symbols64[i].n_type = N_STSYM;
		  symbols64[i].n_sect = (*global_symbol64)->n_sect;
		  symbols64[i].n_value = (*global_symbol64)->n_value;
		}
	      }
	    }
	    else if(! dwarf_debug_map &&
		    (n_type == N_GSYM || n_type == N_FUN) &&
		    (n_strx != 0 && strings[n_strx] != '\0')){
		global_name = strings + n_strx;
		if((global_name[0] == '+' || global_name[0] == '-') &&
		   global_name[1] == '['){
		    j = 2;
		    while(j + n_strx < strsize && global_name[j] != ']')
			j++;
		    if(j + n_strx < strsize && global_name[j] == ']')
			j++;
		}
		else
		    j = 0;
		while(j + n_strx < strsize && global_name[j] != ':')
		    j++;
		if(j + n_strx >= strsize){
		    error_arch(arch, member, "bad N_STAB symbol name for entry "
			"%lu (does not contain ':' separating name from type) "
			"in: ", i);
		    return(FALSE);
		}
		save_char = global_name[j];
		global_name[j] = '\0';

		global_symbol_found = FALSE;
		global_symbol_n_sect = 0;
		if(object->mh != NULL){
		    global_symbol = bsearch(global_name, changed_globals,
					nchanged_globals,sizeof(struct nlist *),
			     		(int (*)(const void *, const void *))
					cmp_bsearch_global_stab);
		    global_symbol64 = NULL;
		    if(global_symbol != NULL){
			global_symbol_found = TRUE;
			global_symbol_n_sect = (*global_symbol)->n_sect;
		    }
		}
		else{
		    global_symbol64 = bsearch(global_name, changed_globals64,
					nchanged_globals,
					sizeof(struct nlist_64 *),
			     		(int (*)(const void *, const void *))
					cmp_bsearch_global_stab_64);
		    global_symbol = NULL;
		    if(global_symbol64 != NULL){
			global_symbol_found = TRUE;
			global_symbol_n_sect = (*global_symbol64)->n_sect;
		    }
		}
		global_name[j] = save_char;
		if(global_symbol_found == TRUE){
		    if(n_type == N_GSYM){
			if(global_symbol_n_sect == data_n_sect){
			    if(object->mh != NULL)
				symbols[i].n_type = N_STSYM;
			    else
				symbols64[i].n_type = N_STSYM;
			}
			else{
			    if(object->mh != NULL)
				symbols[i].n_type = N_FUN;
			    else
				symbols64[i].n_type = N_FUN;
			}
			if(object->mh != NULL){
			    symbols[i].n_sect = (*global_symbol)->n_sect;
			    symbols[i].n_value = (*global_symbol)->n_value;
			    symbols[i].n_desc = (*global_symbol)->n_desc;
			}
			else{
			    symbols64[i].n_sect = (*global_symbol64)->n_sect;
			    symbols64[i].n_value = (*global_symbol64)->n_value;
			    symbols64[i].n_desc = (*global_symbol64)->n_desc;
			}
			if(j + 1 + n_strx >= strsize ||
			   global_name[j+1] != 'G'){
			    error_arch(arch, member, "bad N_GSYM symbol name "
				"for entry %lu (does not have type 'G' after "
				"':' in name) in: ", i);
			    return(FALSE);
			}
		        global_name[j+1] = 'S';
		    }
		    else{ /* n_type == N_FUN */
			if(j + 1 + n_strx >= strsize ||
			   global_name[j+1] == 'F'){
			    global_name[j+1] = 'f';
			}
		    }
		}
	    }
	}
	global_strings = NULL;

	/*
	 * Now what needs to be done is to create the new symbol table moving
	 * those global symbols being changed into non-globals into the areas
	 * in the symbol table for local symbols.  The symbol table and string
	 * table must be in this order:
	 *
	 * symbol table
	 *	local symbols
	 *	external defined symbols
	 *	undefined symbols
	 * string table
	 *	external strings
	 *	local strings
	 */
	if(saves != NULL)
	    free(saves);
	saves = (long *)allocate(nsyms * sizeof(long));
	bzero(saves, nsyms * sizeof(long));

	if(object->mh != NULL){
	    new_symbols = (struct nlist *)
			  allocate(new_nsyms * sizeof(struct nlist));
	    new_symbols64 = NULL;
	}
	else{
	    new_symbols = NULL;
	    new_symbols64 = (struct nlist_64 *)
			    allocate(new_nsyms * sizeof(struct nlist_64));
	}
	new_strsize = round(new_strsize, sizeof(long));
	new_strings = (char *)allocate(new_strsize);
	new_strings[new_strsize - 3] = '\0';
	new_strings[new_strsize - 2] = '\0';
	new_strings[new_strsize - 1] = '\0';

	memset(new_strings, '\0', sizeof(long));
	p = new_strings + sizeof(long);
	q = p + new_ext_strsize;

	/*
	 * If this is a dynamic library the movement of the symbols has to be
	 * done with respect to the modules.  As the local symbols, and external
	 * defined symbols are grouped together for each module.  Then a new
	 * module table needs to be created with the new indexes into the symbol
	 * table for each module.
	 */
	new_nmodtab = nmodtab;
	new_ntoc = ntoc;
	new_nextrefsyms = nextrefsyms;
	if(object->mh_filetype == MH_DYLIB && nmodtab != 0){
	    if(object->mh != NULL){
		new_mods = allocate(nmodtab * sizeof(struct dylib_module));
		new_mods64 = NULL;
	    }
	    else{
		new_mods = NULL;
		new_mods64 = allocate(nmodtab * sizeof(struct dylib_module_64));
	    }

	    inew_syms = 0;
	    /*
	     * This first loop through the module table sets the index and
	     * counts of the local symbols for each module.
	     */
	    for(i = 0; i < nmodtab; i++){
		/*
		 * First put the existing local symbols into the new symbol
		 * table.
		 */
		if(object->mh != NULL){
		    new_mods[i].ilocalsym = inew_syms;
		    new_mods[i].nlocalsym = 0;
		    ilocalsym = mods[i].ilocalsym;
		    nlocalsym = mods[i].nlocalsym;
		}
		else{
		    new_mods64[i].ilocalsym = inew_syms;
		    new_mods64[i].nlocalsym = 0;
		    ilocalsym = mods64[i].ilocalsym;
		    nlocalsym = mods64[i].nlocalsym;
		}
		for(j = ilocalsym; j < ilocalsym + nlocalsym; j++){
		    if(object->mh != NULL){
			n_strx = symbols[j].n_un.n_strx;
			n_type = symbols[j].n_type;
		    }
		    else{
			n_strx = symbols64[j].n_un.n_strx;
			n_type = symbols64[j].n_type;
		    }
		    if((n_type & N_EXT) == 0){
			if(object->mh != NULL)
			    new_symbols[inew_syms] = symbols[j];
			else
			    new_symbols64[inew_syms] = symbols64[j];
			if(n_strx != 0){
			    strcpy(q, strings + n_strx);
			    if(object->mh != NULL)
				new_symbols[inew_syms].n_un.n_strx =
				    q - new_strings;
			    else
				new_symbols64[inew_syms].n_un.n_strx =
				    q - new_strings;
			    q += strlen(q) + 1;
			}
			inew_syms++;
			saves[j] = inew_syms;
			if(object->mh != NULL)
			    new_mods[i].nlocalsym++;
			else
			    new_mods64[i].nlocalsym++;
		    }
		}
		/*
		 * Next put the global symbols that were changed into
		 * non-global symbols into the new symbol table and moved their
		 * counts to the local symbol counts.
		 */
		if(object->mh != NULL){
		    iextdefsym = mods[i].iextdefsym;
		    nextdefsym = mods[i].nextdefsym;
		}
		else{
		    iextdefsym = mods64[i].iextdefsym;
		    nextdefsym = mods64[i].nextdefsym;
		}
		for(j = iextdefsym; j < iextdefsym + nextdefsym; j++){
		    if(object->mh != NULL){
			n_strx = symbols[j].n_un.n_strx;
			n_type = symbols[j].n_type;
		    }
		    else{
			n_strx = symbols64[j].n_un.n_strx;
			n_type = symbols64[j].n_type;
		    }
		    if((n_type & N_EXT) != 0){
			if(nmedits[j] == TRUE){
			    /*
			     * Change the new symbol to a private extern symbol
			     * with the extern bit off.
			     */
			    if(object->mh != NULL){
				new_symbols[inew_syms] = symbols[j];
				new_symbols[inew_syms].n_type |= N_PEXT;
				new_symbols[inew_syms].n_type &= ~N_EXT;
			    }
			    else{
				new_symbols64[inew_syms] = symbols64[j];
				new_symbols64[inew_syms].n_type |= N_PEXT;
				new_symbols64[inew_syms].n_type &= ~N_EXT;
			    }
			    if(n_strx != 0){
				strcpy(q, strings + n_strx);
				if(object->mh != NULL)
				    new_symbols[inew_syms].n_un.n_strx =
					q - new_strings;
				else
				    new_symbols64[inew_syms].n_un.n_strx =
					q - new_strings;
				q += strlen(q) + 1;
			    }
			    inew_syms++;
			    saves[j] = inew_syms;
			    if(object->mh != NULL)
				new_mods[i].nlocalsym++;
			    else
				new_mods64[i].nlocalsym++;
			}
		    }
		}
	    }
	    /*
	     * Next put the unchanged defined global symbols into the new
	     * symbol table.
	     */
	    for(i = 0; i < nmodtab; i++){
		if(object->mh != NULL){
		    new_mods[i].iextdefsym = inew_syms;
		    new_mods[i].nextdefsym = 0;
		    iextdefsym = mods[i].iextdefsym;
		    nextdefsym = mods[i].nextdefsym;
		}
		else{
		    new_mods64[i].iextdefsym = inew_syms;
		    new_mods64[i].nextdefsym = 0;
		    iextdefsym = mods64[i].iextdefsym;
		    nextdefsym = mods64[i].nextdefsym;
		}
		for(j = iextdefsym; j < iextdefsym + nextdefsym; j++){
		    if(object->mh != NULL){
			n_strx = symbols[j].n_un.n_strx;
			n_type = symbols[j].n_type;
		    }
		    else{
			n_strx = symbols64[j].n_un.n_strx;
			n_type = symbols64[j].n_type;
		    }
		    if((n_type & N_EXT) != 0){
			if(nmedits[j] == FALSE){
			    if(object->mh != NULL)
				new_symbols[inew_syms] = symbols[j];
			    else
				new_symbols64[inew_syms] = symbols64[j];
			    if(n_strx != 0){
				strcpy(p, strings + n_strx);
				if(object->mh != NULL)
				    new_symbols[inew_syms].n_un.n_strx =
					p - new_strings;
				else
				    new_symbols64[inew_syms].n_un.n_strx =
					p - new_strings;
				p += strlen(p) + 1;
			    }
			    inew_syms++;
			    saves[j] = inew_syms;
			    if(object->mh != NULL)
				new_mods[i].nextdefsym++;
			    else
				new_mods64[i].nextdefsym++;
			}
		    }
		}
	    }
	    /*
	     * Last put the undefined symbols into the new symbol table.
	     */
	    for(i = 0; i < nsyms; i++){
		if(object->mh != NULL){
		    n_strx = symbols[i].n_un.n_strx;
		    n_type = symbols[i].n_type;
		}
		else{
		    n_strx = symbols64[i].n_un.n_strx;
		    n_type = symbols64[i].n_type;
		}
		if((n_type & N_EXT) != 0 &&
		   ((n_type & N_TYPE) == N_UNDF ||
		    (n_type & N_TYPE) == N_PBUD)){
		    if(object->mh != NULL)
			new_symbols[inew_syms] = symbols[i];
		    else
			new_symbols64[inew_syms] = symbols64[i];
		    if(n_strx != 0){
			strcpy(p, strings + n_strx);
			if(object->mh != NULL)
			    new_symbols[inew_syms].n_un.n_strx =
				p - new_strings;
			else
			    new_symbols64[inew_syms].n_un.n_strx =
				p - new_strings;
			p += strlen(p) + 1;
		    }
		    inew_syms++;
		    saves[i] = inew_syms;
		}
	    }

	    /*
	     * Place the module table's module names with the external strings
	     * and set the names in the new module table.  And then copy the
	     * other unchanged fields.
	     */
	    for(i = 0; i < nmodtab; i++){
		if(object->mh != NULL){
		    strcpy(p, strings + mods[i].module_name);
		    new_mods[i].module_name = p - new_strings;
		    p += strlen(p) + 1;

		    new_mods[i].irefsym = mods[i].irefsym;
		    new_mods[i].nrefsym = mods[i].nrefsym;
		    new_mods[i].iextrel = mods[i].iextrel;
		    new_mods[i].nextrel = mods[i].nextrel;
		    new_mods[i].iinit_iterm = mods[i].iinit_iterm;
		    new_mods[i].ninit_nterm = mods[i].ninit_nterm;
		    new_mods[i].objc_module_info_addr =
			mods[i].objc_module_info_addr;
		    new_mods[i].objc_module_info_size =
			mods[i].objc_module_info_size;
		}
		else{
		    strcpy(p, strings + mods64[i].module_name);
		    new_mods64[i].module_name = p - new_strings;
		    p += strlen(p) + 1;

		    new_mods64[i].irefsym = mods64[i].irefsym;
		    new_mods64[i].nrefsym = mods64[i].nrefsym;
		    new_mods64[i].iextrel = mods64[i].iextrel;
		    new_mods64[i].nextrel = mods64[i].nextrel;
		    new_mods64[i].iinit_iterm = mods64[i].iinit_iterm;
		    new_mods64[i].ninit_nterm = mods64[i].ninit_nterm;
		    new_mods64[i].objc_module_info_addr =
			mods64[i].objc_module_info_addr;
		    new_mods64[i].objc_module_info_size =
			mods64[i].objc_module_info_size;
		}
	    }

	    /*
	     * Update the reference table with the new symbol indexes for all
	     * entries and change type of reference (the flags field) for those
	     * symbols that got changed from globals to non-globals.
	     */
	    new_nextrefsyms = nextrefsyms;
	    new_refs = allocate(new_nextrefsyms *
				sizeof(struct dylib_reference));
	    j = 0;
	    for(i = 0; i < nextrefsyms; i++){
		if(nmedits[refs[i].isym] == TRUE){
		    if(refs[i].flags == REFERENCE_FLAG_DEFINED)
			new_refs[i].flags =
		 	    REFERENCE_FLAG_PRIVATE_DEFINED;
		    else if(refs[i].flags == REFERENCE_FLAG_UNDEFINED_NON_LAZY)
			new_refs[i].flags =
			    REFERENCE_FLAG_PRIVATE_UNDEFINED_NON_LAZY;
		    else if(refs[i].flags == REFERENCE_FLAG_UNDEFINED_LAZY)
			new_refs[i].flags =
			    REFERENCE_FLAG_PRIVATE_UNDEFINED_LAZY;
		    else
			new_refs[i].flags = refs[i].flags;
		}
		else{
		    new_refs[i].flags = refs[i].flags;
		}
		new_refs[i].isym = saves[refs[i].isym] - 1;
	    }

	    /*
	     * Create a new dylib table of contents without the global symbols
	     * that got turned into non-globals.
	     */
	    new_ntoc = ntoc - nchanged_globals;
	    new_tocs = allocate(new_ntoc *
				sizeof(struct dylib_table_of_contents));
	    k = 0;
	    for(i = 0; i < ntoc; i++){
		if(tocs[i].symbol_index >= nsyms){
		    error_arch(arch, member, "bad symbol index for table of "
			"contents table entry %ld in: ", i);
		    return(FALSE);
		}
		if(nmedits[tocs[i].symbol_index] == FALSE){
		    new_tocs[k].symbol_index = saves[tocs[i].symbol_index] - 1;
		    new_tocs[k].module_index = tocs[i].module_index;
		    k++;
		}
	    }
	}
	/*
	 * If is not a dynamic library so all global symbols changed into
	 * statics can be moved to the end of the local symbols.  If the pflag
	 * is set then the changed symbols remain global and just get the
	 * private extern bit set.
	 */
	else{
	    /*
	     * First put the existing local symbols into the new symbol table.
	     */
	    inew_syms = 0;
	    for(i = 0; i < nsyms; i++){
		if(object->mh != NULL){
		    n_strx = symbols[i].n_un.n_strx;
		    n_type = symbols[i].n_type;
		}
		else{
		    n_strx = symbols64[i].n_un.n_strx;
		    n_type = symbols64[i].n_type;
		}
		if((n_type & N_EXT) == 0){
		    if(object->mh != NULL)
			new_symbols[inew_syms] = symbols[i];
		    else
			new_symbols64[inew_syms] = symbols64[i];
		    if(n_strx != 0){
			strcpy(q, strings + n_strx);
			if(object->mh != NULL)
			    new_symbols[inew_syms].n_un.n_strx =
				q - new_strings;
			else
			    new_symbols64[inew_syms].n_un.n_strx =
				q - new_strings;
			q += strlen(q) + 1;
		    }
		    inew_syms++;
		    saves[i] = inew_syms;
		}
	    }
	    /*
	     * Next put the global symbols that were changed into statics
	     * symbols into the new symbol table.
	     */
	    if(pflag == FALSE){
		for(i = 0; i < nsyms; i++){
		    if(object->mh != NULL){
			n_strx = symbols[i].n_un.n_strx;
			n_type = symbols[i].n_type;
		    }
		    else{
			n_strx = symbols64[i].n_un.n_strx;
			n_type = symbols64[i].n_type;
		    }
		    if((n_type & N_EXT) != 0){
			if(nmedits[i] == TRUE){
			    /*
			     * Change the new symbol to not be an extern symbol
			     * by turning off the extern bit.
			     */
			    if(object->mh != NULL){
				new_symbols[inew_syms] = symbols[i];
				new_symbols[inew_syms].n_type &= ~N_EXT;
				new_symbols[inew_syms].n_desc &= ~N_WEAK_DEF;
			    }
			    else{
				new_symbols64[inew_syms] = symbols64[i];
				new_symbols64[inew_syms].n_type &= ~N_EXT;
				new_symbols64[inew_syms].n_desc &= ~N_WEAK_DEF;
			    }
			    if(n_strx != 0){
				strcpy(q, strings + n_strx);
				if(object->mh != NULL)
				    new_symbols[inew_syms].n_un.n_strx =
					q - new_strings;
				else
				    new_symbols64[inew_syms].n_un.n_strx =
					q - new_strings;
				q += strlen(q) + 1;
			    }
			    inew_syms++;
			    saves[i] = inew_syms;
			}
		    }
		}
	    }
	    /*
	     * Last put the unchanged global symbols into the new symbol table
	     * and symbols changed into private externs.
	     */
	    for(i = 0; i < nsyms; i++){
		if(object->mh != NULL){
		    n_strx = symbols[i].n_un.n_strx;
		    n_type = symbols[i].n_type;
		}
		else{
		    n_strx = symbols64[i].n_un.n_strx;
		    n_type = symbols64[i].n_type;
		}
		if((n_type & N_EXT) != 0){
		    if(nmedits[i] == FALSE || pflag == TRUE){
			if(object->mh != NULL)
			    new_symbols[inew_syms] = symbols[i];
			else
			    new_symbols64[inew_syms] = symbols64[i];
			if(nmedits[i] == TRUE && pflag == TRUE){
			    /*
			     * Change the new symbol to be a private extern
			     * symbol by turning on the private extern bit.
			     */
			    if(object->mh != NULL)
				new_symbols[inew_syms].n_type |= N_PEXT;
			    else
				new_symbols64[inew_syms].n_type |= N_PEXT;
			}
			if(n_strx != 0){
			    strcpy(p, strings + n_strx);
			    if(object->mh != NULL)
				new_symbols[inew_syms].n_un.n_strx =
				    p - new_strings;
			    else
				new_symbols64[inew_syms].n_un.n_strx =
				    p - new_strings;
			    p += strlen(p) + 1;
			}
			inew_syms++;
			saves[i] = inew_syms;
		    }
		}
	    }
	}

	if(sections != NULL);
	    free(sections);
	if(sections64 != NULL);
	    free(sections64);

	if(errors == 0)
	    return(TRUE);
	else
	    return(FALSE);
}

/*
 * Function for qsort for comparing global symbol names.
 */
static
int
cmp_qsort_global(
const struct nlist **sym1,
const struct nlist **sym2)
{
	return(strcmp(global_strings + (*sym1)->n_un.n_strx,
		      global_strings + (*sym2)->n_un.n_strx));
}

static
int
cmp_qsort_global_64(
const struct nlist_64 **sym1,
const struct nlist_64 **sym2)
{
	return(strcmp(global_strings + (*sym1)->n_un.n_strx,
		      global_strings + (*sym2)->n_un.n_strx));
}

/*
 * Function for bsearch for finding a global symbol that matches a stab name.
 */
static
int
cmp_bsearch_global_stab(
const char *name,
const struct nlist **sym)
{
	/*
	 * The +1 is for the '_' on the global symbol that is not on the
	 * stab string that is trying to be matched.
	 */
	return(strcmp(name, global_strings + (*sym)->n_un.n_strx + 1));
}

static
int
cmp_bsearch_global_stab_64(
const char *name,
const struct nlist_64 **sym)
{
	/*
	 * The +1 is for the '_' on the global symbol that is not on the
	 * stab string that is trying to be matched.
	 */
	return(strcmp(name, global_strings + (*sym)->n_un.n_strx + 1));
}

/*
 * Function for bsearch for finding a global symbol that matches a stab name
 * in the debug map.
 */
static
int
cmp_bsearch_global(
const char *name,
const struct nlist **sym)
{
	return(strcmp(name, global_strings + (*sym)->n_un.n_strx));
}

static
int
cmp_bsearch_global_64(
const char *name,
const struct nlist_64 **sym)
{
	return(strcmp(name, global_strings + (*sym)->n_un.n_strx));
}
#endif /* defined(NMEDIT) */
