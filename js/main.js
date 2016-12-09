$(document).ready(function() {
  new Clipboard('.btn');
});

function transform()
{
  var fullText = $("#trans-in").val();
  var output = $("#trans-out");

  output.empty();

  if (isBlank(fullText))
    return;

  // Mooji speaking normalisation
  fullText = fullText.replace(/\[\s*m(\.|ooji)\s*\]/gi, "[M:]");

  // Questioner speaking normalisation
  fullText = fullText.replace(/\[\s*(questioner|q\.)\s*\]/gi, "[Q1:]");
  fullText = fullText.replace(/\[\s*q(\d+)\.*\s*\]/gi, "[Q$1:]");
  fullText = fullText.replace(/\[\s*q(uestioner|\.)\s*(\d+)[\s\.]*\]/gi, "[Q$2:]");

  // General laughter normalisation
  fullText = fullText.replace(/\[\s*laughter\s*\]/g, "[Laughter]");

  // Prefer 'okay' spelling
  fullText = fullText.replace(/OK/g, "okay");

  // Lowercase special words
  fullText =
    fullText.replace(/(Being|Grace|Sahaja|Satsang|Self|Supreme)/g,
        function (match) {
          return match.toLowerCase();
        });

  // Undo lowercase of special words when starting a sentence
  fullText =
    fullText.replace(/([\.\!'"\]]\s*)(being|grace|okay|sahaja|satsang|self|supreme)/g,
        function (match, p1, p2) {
          return p1 + capitaliseFirstLetter(p2);
        });

  fullText = escapeHtml(fullText);

  var lines = fullText.split("\n");
  if (!lines || !lines.length)
    return;

  var finalHtml = "<p>";

  for (var i = 0; i < lines.length; i++) {
    if (isBlank(lines[i]))
      continue;

    var line = lines[i].trim();
    var lineLower = line.toLowerCase();

    if (lineLower.startsWith("[m:]") || lineLower.startsWith("[q"))
      finalHtml += "</p><p>" + line;
    else if (lineLower == "[laughter]")
      finalHtml += "</p><p>" + line + "</p><p>";
    else
      finalHtml += line;

    finalHtml += " ";
  }

  finalHtml += "</p>";
  output.append(finalHtml);
}
