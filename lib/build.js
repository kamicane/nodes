"use strict";

var factory = require("./factory");
var typeOf = require("../util/type-of");

var types = factory.types;

function build(ast) {
  if (ast == null) return ast;

  var type = ast.type;

  var NodeClass = types[type];
  if (!NodeClass) throw new Error("missing type (" + type + ")");

  var keys = NodeClass.keys;

  var init = {};

  for (var key in ast) {
    if (key === "type") continue;

    var value = ast[key];

    if (!~keys.indexOf(key)) {
      init[key] = value;
      continue;
    }

    switch (typeOf(value)) {
      case "Array":
        init[key] = value.map(build);
        break;
      case "Object":
        init[key] = build(value);
        break;
      default:
        init[key] = value;
    }
  }

  return new NodeClass(init);
}

module.exports = build;
