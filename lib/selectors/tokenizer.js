module.exports = function Tokenizer(data) {
  var whatsNext = function(context) {
    var cursor = context.cursor;
    var mode = context.mode;
    var closest;

    if (mode == 'body') {
      closest = data.indexOf('}', cursor);
      return closest > -1 ?
        [closest, 'bodyEnd'] :
        null;
    }

    var nextSpecial = data.indexOf('@', cursor);
    var nextEscape = mode == 'top' ? data.indexOf('__CSSCOMMENT', cursor) : -1;
    var nextBodyStart = data.indexOf('{', cursor);
    var nextBodyEnd = data.indexOf('}', cursor);

    closest = nextSpecial;
    if (closest == -1 || (nextEscape > -1 && nextEscape < closest))
      closest = nextEscape;
    if (closest == -1 || (nextBodyStart > -1 && nextBodyStart < closest))
      closest = nextBodyStart;
    if (closest == -1 || (nextBodyEnd > -1 && nextBodyEnd < closest))
      closest = nextBodyEnd;

    if (closest == -1)
      return;
    if (nextEscape === closest)
      return [closest, 'escape'];
    if (nextBodyStart === closest)
      return [closest, 'bodyStart'];
    if (nextBodyEnd === closest)
      return [closest, 'bodyEnd'];
    if (nextSpecial === closest)
      return [closest, 'special'];
  };

  var tokenize = function(context) {
    var tokenized = {};

    context = context || { cursor: 0, mode: 'top' };

    while (true) {
      var next = whatsNext(context);
      if (!next) {
        var whatsLeft = data.substring(context.cursor);
        if (whatsLeft.length > 0) {
          tokenized[whatsLeft] = null;
          context.cursor += whatsLeft.length;
        }
        break;
      }

      var nextSpecial = next[0];
      var what = next[1];
      var nextEnd, oldMode;

      if (what == 'special') {
        var fragment = data.substring(nextSpecial, context.cursor + '@font-face'.length + 1);
        var isSingle = fragment.indexOf('@import') === 0 || fragment.indexOf('@charset') === 0;
        if (isSingle) {
          nextEnd = data.indexOf(';', nextSpecial + 1);
          tokenized[data.substring(context.cursor, nextEnd + 1)] = null;

          context.cursor = nextEnd + 1;
        } else {
          nextEnd = data.indexOf('{', nextSpecial + 1);
          var block = data.substring(context.cursor, nextEnd);

          var isFlat = fragment.indexOf('@font-face') === 0;
          oldMode = context.mode;
          context.cursor = nextEnd + 1;
          context.mode = isFlat ? 'body' : 'block';
          var specialBody = tokenize(context);
          context.mode = oldMode;

          if (!tokenized[block])
            tokenized[block] = { block: true, flat: isFlat, mergeable: !isFlat, body: [] };

          tokenized[block].body.push(specialBody);
        }
      } else if (what == 'escape') {
        nextEnd = data.indexOf('__', nextSpecial + 1);
        var escaped = data.substring(context.cursor, nextEnd + 2);
        tokenized[escaped] = null;

        context.cursor = nextEnd + 2;
      } else if (what == 'bodyStart') {
        var selector = data.substring(context.cursor, nextSpecial);

        oldMode = context.mode;
        context.cursor = nextSpecial + 1;
        context.mode = 'body';
        var body = tokenize(context);
        context.mode = oldMode;

        if (!tokenized[selector])
          tokenized[selector] = { selector: true, body: [] };

        tokenized[selector].body.push(body);
      } else if (what == 'bodyEnd') {
        if (context.mode != 'block') {
          tokenized = data.substring(context.cursor, nextSpecial);
        }
        context.cursor = nextSpecial + 1;

        break;
      }
    }

    return tokenized;
  };

  return {
    process: function() {
      return tokenize();
    }
  };
};
