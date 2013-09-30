var Tokenizer = require('./tokenizer');

module.exports = function Optimizer(data, keepBrakes, lineBreak) {
  var stripRepeats = function(selectors) {
    var plain = [];
    selectors = selectors.split(',');

    for (var i = 0, l = selectors.length; i < l; i++) {
      var sel = selectors[i];

      if (plain.indexOf(sel) == -1)
        plain.push(sel);
    }

    return plain.join(',');
  };

  var mergeProperties = function(node) {
    var merged = {};
    var flat = [];
    var lastKey, firstColon, key, value;

    for (var i = 0, l = node.body.length; i < l; i++) {
      lastKey = null;

      var properties = node.body[i].split(';');
      if (properties.length == 1 && properties[0] === '')
        continue;

      for (var j = 0, m = properties.length; j < m; j++) {
        firstColon = properties[j].indexOf(':');
        key = properties[j].substring(0, firstColon);
        value = properties[j].substring(firstColon + 1);

        if (merged[key] && merged[key].indexOf('!important') > 0 && value.indexOf('!important') == -1)
          continue;

        // comment is necessary - we assume that if two keys are one after another
        // then it is intentional way of redefining property which may be not supported
        if (merged[key] && lastKey === key) {
          if (Array.isArray(merged[key]))
            merged[key].push(value);
          else
            merged[key] = [merged[key], value];
        } else {
          merged[key] = value;
        }

        lastKey = key;
      }
    }

    for (key in merged) {
      value = merged[key];
      if (Array.isArray(value)) {
        for (var k = 0, n = value.length; k < n; k++)
          flat.push(key + ':' + value[k]);
      } else {
        flat.push(key + ':' + value);
      }
    }

    node.body = flat;
  };

  var mergeBlocks = function(node) {
    var target = node.body[0];

    for (var i = 1, l = node.body.length; i < l; i++) {
      var source = node.body[i];

      for (var token in source) {
        var value = source[token];
        if (target[token]) {
          for (var j = 0, m = value.body.length; j < m; j++)
            target[token].body.push(value.body[j]);
        } else {
          target[token] = value;
        }
      }
    }

    node.body = [target];
  };

  var optimize = function(tokens) {
    var mappings = {};

    for (var token in tokens) {
      var value = tokens[token];

      if (!value)
        continue;

      if (value.selector) {
        var optimized = stripRepeats(token);
        if (optimized != token)
          mappings[optimized] = token;

        mergeProperties(value);
      } else if (value.block) {
        if (value.mergeable)
          mergeBlocks(value);

        for (var i = 0, l = value.body.length; i < l; i++)
          optimize(value.body[i]);
      }
    }

    for (var newSelector in mappings) {
      var oldSelector = mappings[newSelector];
      tokens[newSelector] = tokens[oldSelector];
      delete tokens[oldSelector];
    }
  };

  var rebuild = function(tokens) {
    var generated = [];

    for (var token in tokens) {
      var value = tokens[token];
      if (value === null) {
        generated.push(token);
        continue;
      }

      if (value.block) {
        if (value.mergeable) {
          generated.push(token + '{' + rebuild(value.body[0]) + '}');
        } else {
          for (var i = 0, l = value.body.length; i < l; i++) {
            var body = value.flat ? value.body[i] : rebuild(value.body[i]);
            generated.push(token + '{' + body + '}');
          }
        }
      } else if (value.selector) {
        generated.push(token + '{' + value.body.join(';') + '}');
      }
    }

    return generated.join(keepBrakes ? lineBreak : '');
  };

  return {
    process: function() {
      var tokenized = new Tokenizer(data.trim()).process();
      optimize(tokenized);
      return rebuild(tokenized);
    }
  };
};
