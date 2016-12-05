$(document).ready(function() {
  new Clipboard('.btn');
});

function transform()
{
  var input = $("#trans-in").val();
  $("#trans-out").text(input);
}
