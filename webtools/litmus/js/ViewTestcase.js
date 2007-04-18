function checkCategoryForm(f) {
  return verifySelected(f.product, 'Product');
}

function checkIDForm(f) {
  return checkString(f.id, 'Testcase ID #');
}

function checkFulltextForm(f) {
  return checkString(f.text_snippet, 'String to match');
}

function checkRecentForm(f) {
  return checkRadio(f.recently, 'Added or Changed') &&
         checkString(f.num_days, '# of days');
}
