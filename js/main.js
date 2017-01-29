$(document).ready(function() {
  preselectConvertDir();
  new Clipboard('.btn');
  watchAndConvert();
});

function preselectConvertDir() {
  var url = new URL(window.location);
  var convertDir = url.searchParams.get('convert-to');

  if (convertDir == 'transcripts')
    document.getElementById('convert-type').selectedIndex = 0;
  else if (convertDir == 'subtitles')
    document.getElementById('convert-type').selectedIndex = 1;
}

function watchAndConvert() {
  var keyUps =
    Rx.Observable.fromEvent($("#source-txt"), "keyup")
      .pluck("target", "value")
      .debounceTime(250)
      .distinctUntilChanged();
  keyUps.subscribe(updateOutput);
}

function updateOutput(input) {
  var converted = convert(input);
  document.getElementById('converted-out').innerHTML = converted;
}

function convert(fullText) {
  if (isBlank(fullText))
    return "";

  var convertType = $('#convert-type option:selected').val();

  if (convertType == 'sub-trans')
    return subToTrans(fullText);
  else
    return transToSub(fullText);
}

function transToSub(fullText) {
  if (isBlank(fullText))
    return "";

  // Remove ellipsis
  fullText = fullText.replace(/\.\.\./g, '');

  // Remove all bracketed text except a few
  fullText = fullText.replace(/\[.+\]/gi, function (match) {
    var matchLower = match.toLowerCase();
    if (matchLower == "[laughter]" ||
        matchLower == "[silence]" ||
        matchLower == "[music]")
      return match;
    else
      return ' ';
  });

  // Mooji speaking normalisation
  fullText = fullText.replace(/m\s*\:/gi, "[Mooji]");

  // Questioner speaking normalisation
  fullText = fullText.replace(/q\s*\d*\s*\:/gi, "[Questioner]");

  // General laughter normalisation
  fullText = fullText.replace(/\[\s*Laughter\s*\]/g, "[laughter]");

  // Prefer 'OK' spelling
  fullText = fullText.replace(/okay/g, "OK");

  // Uppercase special words
  fullText =
    fullText.replace(/(grace|sahaja|satsang)/g,
        function (match) {
          return capitaliseFirstLetter(match);
        });

  fullText = escapeHtml(fullText);

  var txtLines = fullText.split(/[\n\r]/g);
  var htmlLines = [];

  if (!txtLines || !txtLines.length)
    return "";

  var minLineLength = 6;
  var maxLineLength = 60;

  for (var i = 0; i < txtLines.length; i++) {
    var line = txtLines[i].trim();

    if (!line || !line.length)
      continue;

    // Attach very short lines to previous line
    if (line.length < minLineLength && htmlLines.length) {
      htmlLines[htmlLines.length - 1] += (' ' + line);
    }
    // Split up long lines
    else if (line.length > maxLineLength) {
      var lastWhiteSpacePos = 0;
      var secondLastWhiteSpacePos = 0;
      var lastConsumedPos = -1;

      for (var j = 0; j < line.length; j++) {
        var nextLineLength = lastWhiteSpacePos - lastConsumedPos - 1;

        if (nextLineLength > maxLineLength) {
          var newLine = line.substring(lastConsumedPos + 1, secondLastWhiteSpacePos);
          htmlLines.push(newLine);
          lastConsumedPos = secondLastWhiteSpacePos;
          nextLineLength = 0;
        }

        if (line[j] == ' ' || line[j] == '\t') {
          secondLastWhiteSpacePos = lastWhiteSpacePos;
          lastWhiteSpacePos = j;
        }
      }

      // Append any trailing text
      if (lastConsumedPos < line.length) {
        var trailingLineLength = line.length - lastConsumedPos - 1;

        if (trailingLineLength < minLineLength) {
          htmlLines[htmlLines.length - 1] += (' ' + line.substring(lastConsumedPos));
        }
        else if (trailingLineLength <= maxLineLength) {
          htmlLines.push(line.substring(lastConsumedPos));
        }
        else {
          htmlLines.push(line.substring(lastConsumedPos, lastWhiteSpacePos));

          if ((line.length - 1 - lastWhiteSpacePos) <= minLineLength)
            htmlLines[htmlLines.length - 1] += (' ' + line.substring(lastWhiteSpacePos));
          else
            htmlLines.push(line.substring(lastWhiteSpacePos));
        }
      }
    }
    else {
      htmlLines.push(line);
    }
  }

  var finalHtml = '';

  for (var i = 0; i < htmlLines.length; i++)
    finalHtml += '<p>' + htmlLines[i] + '</p>'

  // Highlight laughter
  finalHtml = finalHtml.replace(/\[laughter\]/gi, '<span class="highlight">[laughter]</span>');

  return finalHtml;
}

function subToTrans(fullText) {
  if (isBlank(fullText))
    return "";

  // Mooji speaking normalisation
  fullText = fullText.replace(/\[\s*m(\.|ooji)\s*\]/gi, "M:");

  // Questioner speaking normalisation
  fullText = fullText.replace(/\[\s*q(uestioner|\.)?\s*(\d*)[\s\.]*\]/gi, "Q$2:");

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
    fullText.replace(/([\.\!'"\:]\s*)(being|grace|okay|sahaja|satsang|self|supreme)/g,
        function (match, p1, p2) {
          return p1 + capitaliseFirstLetter(p2);
        });

  fullText = escapeHtml(fullText);

  var txtLines = fullText.split("\n");

  if (!txtLines || !txtLines.length)
    return "";

  var finalHtml = "<p>";

  for (var i = 0; i < txtLines.length; i++) {
    if (isBlank(txtLines[i]))
      continue;

    var line = txtLines[i].trim();

    if (/^[MQ]\d*\:/.test(line))
      finalHtml += "</p><p>" + line;
    else if (line == "[laughter]")
      finalHtml += "</p><p>" + line + "</p><p>";
    else
      finalHtml += line;

    finalHtml += " ";
  }

  finalHtml += "</p>";
  return finalHtml;
}
