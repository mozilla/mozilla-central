function drop(event) {
  var item = document.getElementById("item1");
  item.parentNode.removeChild(item);
}

function dragStart(event) {
  event.dataTransfer.setData("text/test-type", "test data");
}

function dragOver(event) {
  event.preventDefault();
}

function dragEnter(event) {
  event.preventDefault();
}