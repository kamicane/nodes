"use strict";

var factory = require("./factory");
var typeOf = require("../util/type-of");

var types = factory.types;

function build(ast) {
  if (ast == null) return ast;
  var type = ast.type;
  if (!type) return ast;

  var NodeClass = types[type];
  if (!NodeClass) throw new Error("missing type (" + type + ")");

  var init = {};

  for (var key in ast) {

    var value = ast[key];

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
