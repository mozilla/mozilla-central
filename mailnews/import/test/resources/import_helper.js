/**
 * Returns an import interface based on the name of the module and a string
 * to search for.  Throws an error if it cannot find the module.
 *
 * @param moduleName The name of the module, such as "addressbook"
 * @param searchStr  The string to search the module names for, such as ".csv"
 *                   to find the import module for comma-separated value files
 * @return           An nsIImportGeneric import interface.
 */
function getImportInterface(moduleName, searchStr)
{
  do_check_true(moduleName && moduleName.length > 0);
  do_check_true(searchStr && searchStr.length > 0);

  var importService = Cc["@mozilla.org/import/import-service;1"]
                        .getService(Ci.nsIImportService);
  var module;
  var count = importService.GetModuleCount(moduleName);

  // Iterate through each import module until the one being searched for is found
  for (var i = 0; i < count; i++)
  {
    // Check if the current module fits the search string gets the interface
    if (importService.GetModuleName(moduleName, i).indexOf(searchStr) != -1)
    {
      module = importService.GetModule(moduleName, i);
      break;
    }
  }

  // Make sure the module was found.  If not, return false
  if (!module)
    return null;

  return module.GetImportInterface(moduleName)
               .QueryInterface(Ci.nsIImportGeneric);
}
