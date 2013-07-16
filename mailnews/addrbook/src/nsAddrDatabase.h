/* -*- Mode: C++; tab-width: 2; indent-tabs-mode: nil; c-basic-offset: 2 -*- */
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

#ifndef _nsAddrDatabase_H_
#define _nsAddrDatabase_H_

#include "mozilla/Attributes.h"
#include "nsIAddrDatabase.h"
#include "mdb.h"
#include "nsStringGlue.h"
#include "nsIAddrDBListener.h"
#include "nsCOMPtr.h"
#include "nsTObserverArray.h"
#include "nsWeakPtr.h"
#include "nsIWeakReferenceUtils.h"

typedef enum
{
  AB_NotifyInserted,
  AB_NotifyDeleted,
  AB_NotifyPropertyChanged
} AB_NOTIFY_CODE;

class nsAddrDatabase : public nsIAddrDatabase
{
public:
  NS_DECL_ISUPPORTS
  NS_DECL_NSIADDRDBANNOUNCER
  //////////////////////////////////////////////////////////////////////////////
  // nsIAddrDatabase methods:

  NS_IMETHOD GetDbPath(nsIFile * *aDbPath) MOZ_OVERRIDE;
  NS_IMETHOD SetDbPath(nsIFile * aDbPath) MOZ_OVERRIDE;
  NS_IMETHOD Open(nsIFile *aMabFile, bool aCreate, bool upgrading, nsIAddrDatabase **pCardDB) MOZ_OVERRIDE;
  NS_IMETHOD Close(bool forceCommit) MOZ_OVERRIDE;
  NS_IMETHOD OpenMDB(nsIFile *dbName, bool create) MOZ_OVERRIDE;
  NS_IMETHOD CloseMDB(bool commit) MOZ_OVERRIDE;
  NS_IMETHOD Commit(uint32_t commitType) MOZ_OVERRIDE;
  NS_IMETHOD ForceClosed() MOZ_OVERRIDE;

  NS_IMETHOD CreateNewCardAndAddToDB(nsIAbCard *newCard, bool notify, nsIAbDirectory *parent) MOZ_OVERRIDE;
  NS_IMETHOD CreateNewListCardAndAddToDB(nsIAbDirectory *list, uint32_t listRowID, nsIAbCard *newCard, bool notify) MOZ_OVERRIDE;
  NS_IMETHOD CreateMailListAndAddToDB(nsIAbDirectory *newList, bool notify, nsIAbDirectory *parent) MOZ_OVERRIDE;
  NS_IMETHOD EnumerateCards(nsIAbDirectory *directory, nsISimpleEnumerator **result) MOZ_OVERRIDE;
  NS_IMETHOD GetMailingListsFromDB(nsIAbDirectory *parentDir) MOZ_OVERRIDE;
  NS_IMETHOD EnumerateListAddresses(nsIAbDirectory *directory, nsISimpleEnumerator **result) MOZ_OVERRIDE;
  NS_IMETHOD DeleteCard(nsIAbCard *newCard, bool notify, nsIAbDirectory *parent) MOZ_OVERRIDE;
  NS_IMETHOD EditCard(nsIAbCard *card, bool notify, nsIAbDirectory *parent) MOZ_OVERRIDE;
  NS_IMETHOD ContainsCard(nsIAbCard *card, bool *hasCard) MOZ_OVERRIDE;
  NS_IMETHOD DeleteMailList(nsIAbDirectory *aMailList, nsIAbDirectory *aParent) MOZ_OVERRIDE;
  NS_IMETHOD EditMailList(nsIAbDirectory *mailList, nsIAbCard *listCard, bool notify) MOZ_OVERRIDE;
  NS_IMETHOD ContainsMailList(nsIAbDirectory *mailList, bool *hasCard) MOZ_OVERRIDE;
  NS_IMETHOD DeleteCardFromMailList(nsIAbDirectory *mailList, nsIAbCard *card, bool aNotify) MOZ_OVERRIDE;
  NS_IMETHOD GetCardFromAttribute(nsIAbDirectory *aDirectory, const char *aName,
                                  const nsACString &aValue,
                                  bool aCaseInsensitive, nsIAbCard **card) MOZ_OVERRIDE;
  NS_IMETHOD GetCardsFromAttribute(nsIAbDirectory *aDirectory,
                                   const char *aName,
                                   const nsACString & uUTF8Value,
                                   bool aCaseInsensitive,
                                   nsISimpleEnumerator **cards) MOZ_OVERRIDE;
  NS_IMETHOD GetNewRow(nsIMdbRow * *newRow) MOZ_OVERRIDE;
  NS_IMETHOD GetNewListRow(nsIMdbRow * *newRow) MOZ_OVERRIDE;
  NS_IMETHOD AddCardRowToDB(nsIMdbRow *newRow) MOZ_OVERRIDE;
  NS_IMETHOD AddLdifListMember(nsIMdbRow* row, const char * value) MOZ_OVERRIDE;

  NS_IMETHOD GetDeletedCardList(nsIArray **aResult) MOZ_OVERRIDE;
  NS_IMETHOD GetDeletedCardCount(uint32_t *aCount) MOZ_OVERRIDE;
  NS_IMETHOD PurgeDeletedCardTable();

  NS_IMETHOD AddFirstName(nsIMdbRow * row, const char * value) MOZ_OVERRIDE
  { return AddCharStringColumn(row, m_FirstNameColumnToken, value); }

  NS_IMETHOD AddLastName(nsIMdbRow * row, const char * value) MOZ_OVERRIDE
  { return AddCharStringColumn(row, m_LastNameColumnToken, value); }

  NS_IMETHOD AddPhoneticFirstName(nsIMdbRow * row, const char * value) MOZ_OVERRIDE
  { return AddCharStringColumn(row, m_PhoneticFirstNameColumnToken, value); }

  NS_IMETHOD AddPhoneticLastName(nsIMdbRow * row, const char * value) MOZ_OVERRIDE
  { return AddCharStringColumn(row, m_PhoneticLastNameColumnToken, value); }

  NS_IMETHOD AddDisplayName(nsIMdbRow * row, const char * value) MOZ_OVERRIDE
  { return AddCharStringColumn(row, m_DisplayNameColumnToken, value); }

  NS_IMETHOD AddNickName(nsIMdbRow * row, const char * value) MOZ_OVERRIDE
  { return AddCharStringColumn(row, m_NickNameColumnToken, value); }

  NS_IMETHOD AddPrimaryEmail(nsIMdbRow * row, const char * value) MOZ_OVERRIDE;

  NS_IMETHOD Add2ndEmail(nsIMdbRow * row, const char * value) MOZ_OVERRIDE
  { return AddCharStringColumn(row, m_2ndEmailColumnToken, value); }

  NS_IMETHOD AddPreferMailFormat(nsIMdbRow * row, uint32_t value) MOZ_OVERRIDE
  { return AddIntColumn(row, m_MailFormatColumnToken, value); }

  NS_IMETHOD AddPopularityIndex(nsIMdbRow * row, uint32_t value) MOZ_OVERRIDE
  { return AddIntColumn(row, m_PopularityIndexColumnToken, value); }

  NS_IMETHOD AddAllowRemoteContent(nsIMdbRow * row, bool value) MOZ_OVERRIDE
  { return AddBoolColumn(row, m_AllowRemoteContentColumnToken, value); }

  NS_IMETHOD AddWorkPhone(nsIMdbRow * row, const char * value) MOZ_OVERRIDE
  { return AddCharStringColumn(row, m_WorkPhoneColumnToken, value); }

  NS_IMETHOD AddHomePhone(nsIMdbRow * row, const char * value) MOZ_OVERRIDE
  { return AddCharStringColumn(row, m_HomePhoneColumnToken, value); }

  NS_IMETHOD AddFaxNumber(nsIMdbRow * row, const char * value) MOZ_OVERRIDE
  { return AddCharStringColumn(row, m_FaxColumnToken, value); }

  NS_IMETHOD AddPagerNumber(nsIMdbRow * row, const char * value) MOZ_OVERRIDE
  { return AddCharStringColumn(row, m_PagerColumnToken, value); }

  NS_IMETHOD AddCellularNumber(nsIMdbRow * row, const char * value) MOZ_OVERRIDE
  { return AddCharStringColumn(row, m_CellularColumnToken, value); }

  NS_IMETHOD AddWorkPhoneType(nsIMdbRow * row, const char * value) MOZ_OVERRIDE
  { return AddCharStringColumn(row, m_WorkPhoneTypeColumnToken, value); }

  NS_IMETHOD AddHomePhoneType(nsIMdbRow * row, const char * value) MOZ_OVERRIDE
  { return AddCharStringColumn(row, m_HomePhoneTypeColumnToken, value); }

  NS_IMETHOD AddFaxNumberType(nsIMdbRow * row, const char * value) MOZ_OVERRIDE
  { return AddCharStringColumn(row, m_FaxTypeColumnToken, value); }

  NS_IMETHOD AddPagerNumberType(nsIMdbRow * row, const char * value) MOZ_OVERRIDE
  { return AddCharStringColumn(row, m_PagerTypeColumnToken, value); }

  NS_IMETHOD AddCellularNumberType(nsIMdbRow * row, const char * value) MOZ_OVERRIDE
  { return AddCharStringColumn(row, m_CellularTypeColumnToken, value); }

  NS_IMETHOD AddHomeAddress(nsIMdbRow * row, const char * value) MOZ_OVERRIDE
  { return AddCharStringColumn(row, m_HomeAddressColumnToken, value); }

  NS_IMETHOD AddHomeAddress2(nsIMdbRow * row, const char * value) MOZ_OVERRIDE
  { return AddCharStringColumn(row, m_HomeAddress2ColumnToken, value); }

  NS_IMETHOD AddHomeCity(nsIMdbRow * row, const char * value) MOZ_OVERRIDE
  { return AddCharStringColumn(row, m_HomeCityColumnToken, value); }

  NS_IMETHOD AddHomeState(nsIMdbRow * row, const char * value) MOZ_OVERRIDE
  { return AddCharStringColumn(row, m_HomeStateColumnToken, value); }

  NS_IMETHOD AddHomeZipCode(nsIMdbRow * row, const char * value) MOZ_OVERRIDE
  { return AddCharStringColumn(row, m_HomeZipCodeColumnToken, value); }

  NS_IMETHOD AddHomeCountry(nsIMdbRow * row, const char * value) MOZ_OVERRIDE
  { return AddCharStringColumn(row, m_HomeCountryColumnToken, value); }

  NS_IMETHOD AddWorkAddress(nsIMdbRow * row, const char * value) MOZ_OVERRIDE
  { return AddCharStringColumn(row, m_WorkAddressColumnToken, value); }

  NS_IMETHOD AddWorkAddress2(nsIMdbRow * row, const char * value) MOZ_OVERRIDE
  { return AddCharStringColumn(row, m_WorkAddress2ColumnToken, value); }

  NS_IMETHOD AddWorkCity(nsIMdbRow * row, const char * value) MOZ_OVERRIDE
  { return AddCharStringColumn(row, m_WorkCityColumnToken, value); }

  NS_IMETHOD AddWorkState(nsIMdbRow * row, const char * value) MOZ_OVERRIDE
  { return AddCharStringColumn(row, m_WorkStateColumnToken, value); }

  NS_IMETHOD AddWorkZipCode(nsIMdbRow * row, const char * value) MOZ_OVERRIDE
  { return AddCharStringColumn(row, m_WorkZipCodeColumnToken, value); }

  NS_IMETHOD AddWorkCountry(nsIMdbRow * row, const char * value) MOZ_OVERRIDE
  { return AddCharStringColumn(row, m_WorkCountryColumnToken, value); }

  NS_IMETHOD AddJobTitle(nsIMdbRow * row, const char * value) MOZ_OVERRIDE
  { return AddCharStringColumn(row, m_JobTitleColumnToken, value); }

  NS_IMETHOD AddDepartment(nsIMdbRow * row, const char * value) MOZ_OVERRIDE
  { return AddCharStringColumn(row, m_DepartmentColumnToken, value); }

  NS_IMETHOD AddCompany(nsIMdbRow * row, const char * value) MOZ_OVERRIDE
  { return AddCharStringColumn(row, m_CompanyColumnToken, value); }

  NS_IMETHOD AddAimScreenName(nsIMdbRow * row, const char * value) MOZ_OVERRIDE
  { return AddCharStringColumn(row, m_AimScreenNameColumnToken, value); }

  NS_IMETHOD AddAnniversaryYear(nsIMdbRow * row, const char * value) MOZ_OVERRIDE
  { return AddCharStringColumn(row, m_AnniversaryYearColumnToken, value); }

  NS_IMETHOD AddAnniversaryMonth(nsIMdbRow * row, const char * value) MOZ_OVERRIDE
  { return AddCharStringColumn(row, m_AnniversaryMonthColumnToken, value); }

  NS_IMETHOD AddAnniversaryDay(nsIMdbRow * row, const char * value) MOZ_OVERRIDE
  { return AddCharStringColumn(row, m_AnniversaryDayColumnToken, value); }

  NS_IMETHOD AddSpouseName(nsIMdbRow * row, const char * value) MOZ_OVERRIDE
  { return AddCharStringColumn(row, m_SpouseNameColumnToken, value); }

  NS_IMETHOD AddFamilyName(nsIMdbRow * row, const char * value) MOZ_OVERRIDE
  { return AddCharStringColumn(row, m_FamilyNameColumnToken, value); }

  NS_IMETHOD AddDefaultAddress(nsIMdbRow * row, const char * value) MOZ_OVERRIDE
  { return AddCharStringColumn(row, m_DefaultAddressColumnToken, value); }

  NS_IMETHOD AddCategory(nsIMdbRow * row, const char * value) MOZ_OVERRIDE
  { return AddCharStringColumn(row, m_CategoryColumnToken, value); }

  NS_IMETHOD AddWebPage1(nsIMdbRow * row, const char * value) MOZ_OVERRIDE
  { return AddCharStringColumn(row, m_WebPage1ColumnToken, value); }

  NS_IMETHOD AddWebPage2(nsIMdbRow * row, const char * value) MOZ_OVERRIDE
  { return AddCharStringColumn(row, m_WebPage2ColumnToken, value); }

  NS_IMETHOD AddBirthYear(nsIMdbRow * row, const char * value) MOZ_OVERRIDE
  { return AddCharStringColumn(row, m_BirthYearColumnToken, value); }

  NS_IMETHOD AddBirthMonth(nsIMdbRow * row, const char * value) MOZ_OVERRIDE
  { return AddCharStringColumn(row, m_BirthMonthColumnToken, value); }

  NS_IMETHOD AddBirthDay(nsIMdbRow * row, const char * value) MOZ_OVERRIDE
  { return AddCharStringColumn(row, m_BirthDayColumnToken, value); }

  NS_IMETHOD AddCustom1(nsIMdbRow * row, const char * value) MOZ_OVERRIDE
  { return AddCharStringColumn(row, m_Custom1ColumnToken, value); }

  NS_IMETHOD AddCustom2(nsIMdbRow * row, const char * value) MOZ_OVERRIDE
  { return AddCharStringColumn(row, m_Custom2ColumnToken, value); }

  NS_IMETHOD AddCustom3(nsIMdbRow * row, const char * value) MOZ_OVERRIDE
  { return AddCharStringColumn(row, m_Custom3ColumnToken, value); }

  NS_IMETHOD AddCustom4(nsIMdbRow * row, const char * value) MOZ_OVERRIDE
  { return AddCharStringColumn(row, m_Custom4ColumnToken, value); }

  NS_IMETHOD AddNotes(nsIMdbRow * row, const char * value) MOZ_OVERRIDE
  { return AddCharStringColumn(row, m_NotesColumnToken, value); }

  NS_IMETHOD AddListName(nsIMdbRow * row, const char * value) MOZ_OVERRIDE;

  NS_IMETHOD AddListNickName(nsIMdbRow * row, const char * value) MOZ_OVERRIDE
  { return AddCharStringColumn(row, m_ListNickNameColumnToken, value); }

  NS_IMETHOD AddListDescription(nsIMdbRow * row, const char * value) MOZ_OVERRIDE
  { return AddCharStringColumn(row, m_ListDescriptionColumnToken, value); }


  NS_IMETHOD AddListDirNode(nsIMdbRow * listRow) MOZ_OVERRIDE;

  NS_IMETHOD FindMailListbyUnicodeName(const PRUnichar *listName, bool *exist) MOZ_OVERRIDE;

  NS_IMETHOD GetCardCount(uint32_t *count) MOZ_OVERRIDE;

  NS_IMETHOD SetCardValue(nsIAbCard *card, const char *name, const PRUnichar *value, bool notify) MOZ_OVERRIDE;
  NS_IMETHOD GetCardValue(nsIAbCard *card, const char *name, PRUnichar **value) MOZ_OVERRIDE;
  // nsAddrDatabase methods:

  nsAddrDatabase();
  virtual ~nsAddrDatabase();

  void GetMDBFactory(nsIMdbFactory ** aMdbFactory);
  nsIMdbEnv    *GetEnv() {return m_mdbEnv;}
  uint32_t    GetCurVersion();
  nsIMdbTableRowCursor *GetTableRowCursor();
  nsIMdbTable    *GetPabTable() {return m_mdbPabTable;}

  static nsAddrDatabase* FindInCache(nsIFile *dbName);

  static void    CleanupCache();

  nsresult CreateABCard(nsIMdbRow* cardRow, mdb_id listRowID, nsIAbCard **result);
  nsresult CreateABListCard(nsIMdbRow* listRow, nsIAbCard **result);
  nsresult CreateABList(nsIMdbRow* listRow, nsIAbDirectory **result);

  bool IsListRowScopeToken(mdb_scope scope) { return (scope == m_ListRowScopeToken) ? true: false; }
  bool IsCardRowScopeToken(mdb_scope scope) { return (scope == m_CardRowScopeToken) ? true: false;  }
  bool IsDataRowScopeToken(mdb_scope scope) { return (scope == m_DataRowScopeToken) ? true: false; }
  nsresult GetCardRowByRowID(mdb_id rowID, nsIMdbRow **dbRow);
  nsresult GetListRowByRowID(mdb_id rowID, nsIMdbRow **dbRow);

  uint32_t GetListAddressTotal(nsIMdbRow* listRow);
  nsresult GetAddressRowByPos(nsIMdbRow* listRow, uint16_t pos, nsIMdbRow** cardRow);

    NS_IMETHOD AddListCardColumnsToRow(nsIAbCard *aPCard, nsIMdbRow *aPListRow, uint32_t aPos, nsIAbCard** aPNewCard, bool aInMailingList, nsIAbDirectory *aParent, nsIAbDirectory *aRoot) MOZ_OVERRIDE;
    NS_IMETHOD InitCardFromRow(nsIAbCard *aNewCard, nsIMdbRow* aCardRow) MOZ_OVERRIDE;
    NS_IMETHOD SetListAddressTotal(nsIMdbRow* aListRow, uint32_t aTotal) MOZ_OVERRIDE;
    NS_IMETHOD FindRowByCard(nsIAbCard * card,nsIMdbRow **aRow) MOZ_OVERRIDE;

protected:

  static void RemoveFromCache(nsAddrDatabase* pAddrDB);
  bool MatchDbName(nsIFile *dbName); // returns TRUE if they match

  void YarnToUInt32(struct mdbYarn *yarn, uint32_t *pResult);
  void GetCharStringYarn(char* str, struct mdbYarn* strYarn);
  void GetStringYarn(const nsAString & aStr, struct mdbYarn* strYarn);
  void GetIntYarn(uint32_t nValue, struct mdbYarn* intYarn);
  nsresult AddCharStringColumn(nsIMdbRow* cardRow, mdb_column inColumn, const char* str);
  nsresult AddStringColumn(nsIMdbRow* aCardRow, mdb_column aInColumn, const nsAString & aStr);
  nsresult AddIntColumn(nsIMdbRow* cardRow, mdb_column inColumn, uint32_t nValue);
  nsresult AddBoolColumn(nsIMdbRow* cardRow, mdb_column inColumn, bool bValue);
  nsresult GetStringColumn(nsIMdbRow *cardRow, mdb_token outToken, nsString& str);
  nsresult GetIntColumn(nsIMdbRow *cardRow, mdb_token outToken,
              uint32_t* pValue, uint32_t defaultValue);
  nsresult GetBoolColumn(nsIMdbRow *cardRow, mdb_token outToken, bool* pValue);
  nsresult GetListCardFromDB(nsIAbCard *listCard, nsIMdbRow* listRow);
  nsresult GetListFromDB(nsIAbDirectory *newCard, nsIMdbRow* listRow);
  nsresult AddRecordKeyColumnToRow(nsIMdbRow *pRow);
  nsresult AddAttributeColumnsToRow(nsIAbCard *card, nsIMdbRow *cardRow);
  nsresult AddListAttributeColumnsToRow(nsIAbDirectory *list, nsIMdbRow *listRow, nsIAbDirectory *parent);
  nsresult CreateCard(nsIMdbRow* cardRow, mdb_id listRowID, nsIAbCard **result);
  nsresult CreateCardFromDeletedCardsTable(nsIMdbRow* cardRow, mdb_id listRowID, nsIAbCard **result);
  nsresult DeleteCardFromListRow(nsIMdbRow* pListRow, mdb_id cardRowID);
  void DeleteCardFromAllMailLists(mdb_id cardRowID);
  nsresult NotifyListEntryChange(uint32_t abCode, nsIAbDirectory *dir);

  nsresult AddLowercaseColumn(nsIMdbRow * row, mdb_token columnToken, const char* utf8String);
  nsresult GetRowFromAttribute(const char *aName, const nsACString &aUTF8Value,
                               bool aCaseInsensitive, nsIMdbRow  **aCardRow,
                               mdb_pos *aRowPos);

  static nsTArray<nsAddrDatabase*>* m_dbCache;
  static nsTArray<nsAddrDatabase*>* GetDBCache();

  // mdb bookkeeping stuff
  nsresult      InitExistingDB();
  nsresult      InitNewDB();
  nsresult      InitMDBInfo();
  nsresult      InitPabTable();
  nsresult      InitDeletedCardsTable(bool aCreate);
  nsresult      AddRowToDeletedCardsTable(nsIAbCard *card, nsIMdbRow **pCardRow);
  nsresult      DeleteRowFromDeletedCardsTable(nsIMdbRow *pCardRow);

  nsresult      InitLastRecorKey();
  nsresult      GetDataRow(nsIMdbRow **pDataRow);
  nsresult      GetLastRecordKey();
  nsresult      UpdateLastRecordKey();
  nsresult      CheckAndUpdateRecordKey();
  nsresult      UpdateLowercaseEmailListName();
  nsresult      ConvertAndAddLowercaseColumn(nsIMdbRow * row, mdb_token fromCol, mdb_token toCol);
  nsresult      AddUnicodeToColumn(nsIMdbRow * row, mdb_token colToken, mdb_token lowerCaseColToken, const PRUnichar* pUnicodeStr);

  nsresult      DeleteRow(nsIMdbTable* dbTable, nsIMdbRow* dbRow);

  nsIMdbEnv   *m_mdbEnv;  // to be used in all the db calls.
  nsIMdbStore *m_mdbStore;
  nsIMdbTable *m_mdbPabTable;
  nsIMdbTable *m_mdbDeletedCardsTable;
  nsCOMPtr<nsIFile> m_dbName;
  bool          m_mdbTokensInitialized;
  nsTObserverArray<nsIAddrDBListener*> m_ChangeListeners;

  mdb_kind      m_PabTableKind;
  mdb_kind      m_MailListTableKind;
  mdb_kind      m_DeletedCardsTableKind;

  mdb_scope      m_CardRowScopeToken;
  mdb_scope      m_ListRowScopeToken;
  mdb_scope      m_DataRowScopeToken;

  mdb_token      m_FirstNameColumnToken;
  mdb_token      m_LastNameColumnToken;
  mdb_token      m_PhoneticFirstNameColumnToken;
  mdb_token      m_PhoneticLastNameColumnToken;
  mdb_token      m_DisplayNameColumnToken;
  mdb_token      m_NickNameColumnToken;
  mdb_token      m_PriEmailColumnToken;
  mdb_token      m_2ndEmailColumnToken;
  mdb_token      m_DefaultEmailColumnToken;
  mdb_token      m_CardTypeColumnToken;
  mdb_token      m_WorkPhoneColumnToken;
  mdb_token      m_HomePhoneColumnToken;
  mdb_token      m_FaxColumnToken;
  mdb_token      m_PagerColumnToken;
  mdb_token      m_CellularColumnToken;
  mdb_token      m_WorkPhoneTypeColumnToken;
  mdb_token      m_HomePhoneTypeColumnToken;
  mdb_token      m_FaxTypeColumnToken;
  mdb_token      m_PagerTypeColumnToken;
  mdb_token      m_CellularTypeColumnToken;
  mdb_token      m_HomeAddressColumnToken;
  mdb_token      m_HomeAddress2ColumnToken;
  mdb_token      m_HomeCityColumnToken;
  mdb_token      m_HomeStateColumnToken;
  mdb_token      m_HomeZipCodeColumnToken;
  mdb_token      m_HomeCountryColumnToken;
  mdb_token      m_WorkAddressColumnToken;
  mdb_token      m_WorkAddress2ColumnToken;
  mdb_token      m_WorkCityColumnToken;
  mdb_token      m_WorkStateColumnToken;
  mdb_token      m_WorkZipCodeColumnToken;
  mdb_token      m_WorkCountryColumnToken;
  mdb_token      m_JobTitleColumnToken;
  mdb_token      m_DepartmentColumnToken;
  mdb_token      m_CompanyColumnToken;
  mdb_token      m_AimScreenNameColumnToken;
  mdb_token      m_AnniversaryYearColumnToken;
  mdb_token      m_AnniversaryMonthColumnToken;
  mdb_token      m_AnniversaryDayColumnToken;
  mdb_token      m_SpouseNameColumnToken;
  mdb_token      m_FamilyNameColumnToken;
  mdb_token      m_DefaultAddressColumnToken;
  mdb_token      m_CategoryColumnToken;
  mdb_token      m_WebPage1ColumnToken;
  mdb_token      m_WebPage2ColumnToken;
  mdb_token      m_BirthYearColumnToken;
  mdb_token      m_BirthMonthColumnToken;
  mdb_token      m_BirthDayColumnToken;
  mdb_token      m_Custom1ColumnToken;
  mdb_token      m_Custom2ColumnToken;
  mdb_token      m_Custom3ColumnToken;
  mdb_token      m_Custom4ColumnToken;
  mdb_token      m_NotesColumnToken;
  mdb_token      m_LastModDateColumnToken;
  mdb_token      m_RecordKeyColumnToken;
  mdb_token      m_LowerPriEmailColumnToken;

  mdb_token      m_MailFormatColumnToken;
  mdb_token     m_PopularityIndexColumnToken;
  mdb_token     m_AllowRemoteContentColumnToken;

  mdb_token      m_AddressCharSetColumnToken;
  mdb_token      m_LastRecordKeyColumnToken;

  mdb_token      m_ListNameColumnToken;
  mdb_token      m_ListNickNameColumnToken;
  mdb_token      m_ListDescriptionColumnToken;
  mdb_token      m_ListTotalColumnToken;
  mdb_token      m_LowerListNameColumnToken;

  uint32_t      m_LastRecordKey;
  nsWeakPtr m_dbDirectory;
  nsCOMPtr<nsIMdbFactory> mMdbFactory;

private:
  nsresult GetRowForCharColumn(const PRUnichar *unicodeStr,
                               mdb_column findColumn, bool bIsCard,
                               bool aCaseInsensitive, nsIMdbRow **findRow,
                               mdb_pos *aRowPos);
  bool HasRowButDeletedForCharColumn(const PRUnichar *unicodeStr, mdb_column findColumn, bool aIsCard, nsIMdbRow **aFindRow);
  nsresult OpenInternal(nsIFile *aMabFile, bool aCreate, nsIAddrDatabase **pCardDB);
  nsresult AlertAboutCorruptMabFile(const PRUnichar *aOldFileName, const PRUnichar *aNewFileName);
  nsresult AlertAboutLockedMabFile(const PRUnichar *aFileName);
  nsresult DisplayAlert(const PRUnichar *titleName, const PRUnichar *alertStringName,
                        const PRUnichar **formatStrings, int32_t numFormatStrings);
};

#endif
