var domain = {
  minLineLength: 6,
  minLineLengthDefault: 6,

  maxLineLength: 60,
  maxLineLengthDefault: 60,

  numJoinLines: 30,
  numJoinLinesDefault: 30,

  hasMinLineLength: function() {
    return this.minLineLength > 0;
  },

  hasMaxLineLength: function() {
    return this.maxLineLength > 0;
  },

  hasNumJoinLines: function() {
    return this.numJoinLines > 0;
  },
};

$(document).ready(function() {

  preselectConvertDir();

  new Clipboard('.btn');

  watchAndConvert();
});

function preselectConvertDir() {
  var url = new URL(window.location);
  var convertDir = url.searchParams.get('convert-to');

  if (convertDir == 'transcripts') {
    document.getElementById('convert-type').selectedIndex = 0;
    showJoinLinesOption();
  }
  else if (convertDir == 'subtitles') {
    document.getElementById('convert-type').selectedIndex = 1;
    showLineLengthOptions();
  }
}

function updateMinLineLength(val) {
  clearErrorMsg();

  var newVal = domain.minLineLengthDefault;

  if (!isBlank(val)) {
    newVal = parseInt(val);

    if (isNaN(newVal) || newVal < 0)
      return setErrorMsg('The minimum line length must be zero or a positive number.');
  }

  domain.minLineLength = newVal;
  updateOutput(document.getElementById('source-txt').value);
}

function updateMaxLineLength(val) {
  clearErrorMsg();

  var newVal = domain.maxLineLengthDefault;

  if (!isBlank(val)) {
    newVal = parseInt(val);

    if (isNaN(newVal) || newVal < 0)
      return setErrorMsg('The maximum line length must be zero or a positive number.');
  }

  domain.maxLineLength = newVal;
  updateOutput(document.getElementById('source-txt').value);
}

function updateNumJoinLines(val) {
  clearErrorMsg();

  var newVal = domain.numJoinLinesDefault;

  if (!isBlank(val)) {
    newVal = parseInt(val);

    if (isNaN(newVal) || newVal < 0)
      return setErrorMsg('The number of lines to join must be zero or a positive number.');
  }

  domain.numJoinLines = newVal;
  updateOutput(document.getElementById('source-txt').value);
}

function onConvertTypeChanged() {
  var convertDirIdx = document.getElementById('convert-type').selectedIndex;

  if (convertDirIdx == 0) {
    hideLineLengthOptions();
    showJoinLinesOption();
  }
  else if (convertDirIdx == 1) {
    showLineLengthOptions();
    hideJoinLinesOption();
  }

  updateOutput(document.getElementById('source-txt').value);
}

function showLineLengthOptions() {
  document.getElementById('min-line-length').classList.remove('hidden');
  document.getElementById('max-line-length').classList.remove('hidden');
}
function hideLineLengthOptions() {
  document.getElementById('min-line-length').classList.add('hidden');
  document.getElementById('max-line-length').classList.add('hidden');
}
function showJoinLinesOption() {
  document.getElementById('num-join-lines').classList.remove('hidden');
}
function hideJoinLinesOption() {
  document.getElementById('num-join-lines').classList.add('hidden');
}

function setErrorMsg(msg) {
  var el = document.getElementById('error-msg');
  el.innerText = msg;
}
function clearErrorMsg() {
  document.getElementById('error-msg').innerText = '';
}

function watchAndConvert() {
  // Watch for changes to the source text <textarea>
  Rx.Observable.fromEvent($("#source-txt"), "keyup")
    .pluck("target", "value")
    .debounceTime(250)
    .distinctUntilChanged()
    .subscribe(updateOutput);

  // Watch for changes to the minimum line length option
  Rx.Observable.fromEvent($("#min-line-length"), "keyup")
    .pluck("target", "value")
    .debounceTime(500)
    .distinctUntilChanged()
    .subscribe(updateMinLineLength);

  // Watch for changes to the maximum line length option
  Rx.Observable.fromEvent($("#max-line-length"), "keyup")
    .pluck("target", "value")
    .debounceTime(500)
    .distinctUntilChanged()
    .subscribe(updateMaxLineLength);

  // Watch for changes to the join lines option
  Rx.Observable.fromEvent($("#num-join-lines"), "keyup")
    .pluck("target", "value")
    .debounceTime(500)
    .distinctUntilChanged()
    .subscribe(updateNumJoinLines);
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

  // Replace all single-quote chars to the simple (vertical) quote
  fullText = fullText.replace(/[´’‘]/g, "'");

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
  fullText = fullText.replace(/q\s*\d*\s*\:/gi, "[Q.]");

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

  for (var i = 0; i < txtLines.length; i++) {
    var line = txtLines[i].trim();

    if (!line || !line.length)
      continue;

    // Attach very short lines to previous line
    if (domain.hasMinLineLength()
        && (line.length < domain.minLineLength) && htmlLines.length)
    {
      htmlLines[htmlLines.length - 1] += (' ' + line);
    }
    // Split up long lines
    else if (domain.hasMaxLineLength() && (line.length > domain.maxLineLength)) {
      var lastWhiteSpacePos = 0;
      var secondLastWhiteSpacePos = 0;
      var lastConsumedPos = -1;

      for (var j = 0; j < line.length; j++) {
        var nextLineLength = lastWhiteSpacePos - lastConsumedPos - 1;

        if (domain.hasMaxLineLength()
            && (nextLineLength > domain.maxLineLength))
        {
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

        if (domain.hasMinLineLength()
            && (trailingLineLength < domain.minLineLength))
        {
          htmlLines[htmlLines.length - 1] += (' ' + line.substring(lastConsumedPos));
        }
        else if (domain.hasMaxLineLength()
                 && (trailingLineLength <= domain.maxLineLength))
        {
          htmlLines.push(line.substring(lastConsumedPos));
        }
        else
        {
          htmlLines.push(line.substring(lastConsumedPos, lastWhiteSpacePos));

          if (domain.hasMinLineLength()
              && (line.length - 1 - lastWhiteSpacePos) <= domain.minLineLength) {
            htmlLines[htmlLines.length - 1] += (' ' + line.substring(lastWhiteSpacePos));
          }
          else {
            htmlLines.push(line.substring(lastWhiteSpacePos));
          }
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

  var linesSinceLastBreak = 0;

  var finalHtml = "<p>";

  var lastTimeStamp = "";

  for (var i = 0; i < txtLines.length; i++) {
    if (isBlank(txtLines[i]))
      continue;

    var currLine = txtLines[i].trim();

    // Start a new line for speaker transition
    if (/^[MQ]\d*\:/.test(currLine)) {
      //console.log('new line [' + i + ']: ' + currLine);
      finalHtml += "</p><p>" + lastTimeStamp + " " + currLine;
      linesSinceLastBreak = 0;
    }
    // Separate line for bracketed text (e.g. Youtube captions source)
    else if (/^\[.+\]$/.test(currLine)) {
      //console.log('new line [' + i + ']: ' + currLine);
      finalHtml += "</p><p>" + lastTimeStamp + " " + currLine + "</p><p>";
      linesSinceLastBreak = 0;
    }
    // Skip timestamp for now (Youtube captions source)
    else if (/^(\d+\:)+\d+$/.test(currLine)) {
      //console.log('timestamp[' + i + ']: ' + currLine);
      lastTimeStamp = currLine;
    }
    else {
      // Break line if user-defined limit is reached
      if (linesSinceLastBreak >= domain.numJoinLines) {
        //console.log('about to break[' + i + '] on ' + lastTimeStamp + ' - ' + currLine);
        finalHtml += "</p><p>" + lastTimeStamp + " " + currLine;
        linesSinceLastBreak = 0;
      }
      else {
        //console.log('new line [' + i + ']: ' + currLine);
        finalHtml += currLine;
        linesSinceLastBreak++;
      }
    }

    finalHtml += " ";
  }

  finalHtml += "</p>";
  return finalHtml;
}
