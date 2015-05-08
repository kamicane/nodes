// slick finder, for the JavaScript AST
"use strict";

var parse = require("slick/parser");

var factory = require("./factory");
var typeOf = require("../util/type-of");

var types = factory.types;
var syntax = factory.syntax;
var instanceOf = factory.instanceOf;

var BaseList = factory.BaseList;
var Node = factory.Node;

var cw = function(value) { // config, write
  return { value: value, enumerable: false, configurable: true, writable: true };
};

var define = Object.defineProperty;

function normalize(value) {
  if (value !== "" && !isNaN(value)) return +value;
  else if (value === "true") return true;
  else if (value === "false") return false;
  else if (value === "null") return null;
  else if (value === "undefined") return undefined;
  return value;
}

function isPrimitive(value) {
  return (/^(Undefined|Null|String|RegExp|Boolean|Number)$/).test(typeOf(value));
}

function spliceUnique(list, atIndex, howMany, values) {
  var accepted = [];
  for (var i = 0; i < values.length; i++) {
    var value = values[i];
    if (!~list.indexOf(value)) accepted.push(value);
  }
  if (accepted.length) list.splice.apply(list, [atIndex, howMany].concat(accepted));
  else if (howMany) list.splice(atIndex, howMany); // a list that contained only duplicate items needs to be removed.
  return list;
}

function partString(part) {
  var partArray = [];
  if (part.combinator !== " ") partArray.push(part.combinator);
  partArray.push(part.toString());
  return partArray.join(" ");
}

function matchContextParts(cache, context, parts, index) {

  var part = parts[index++];
  var string = partString(part);
  var uid = context.uid;
  var cacheContext = cache[uid] || (cache[uid] = {});

  var matched;

  var last = (parts.length === index);

  if (cacheContext[string]) {
    matched = cacheContext[string];
  } else {
    matched = new BaseList;

    iterators[part.combinator](context, function(node, key) {
      if (match(node, part, key)) spliceUnique(matched, matched.length, 0, [node]);
    });

    cacheContext[string] = matched;
  }

  if (last) return matched;

  var resultSet = new BaseList;

  matched.forEach(function(node) {
    if (isPrimitive(node)) return false;

    var results = matchContextParts(cache, node, parts, index);
    spliceUnique(resultSet, resultSet.length, 0, results);
  });

  return resultSet;
}

function search(context, expression) {

  var found;

  var expressions = parse(expression);

  var matched;
  var lastExpression, firstExpression;
  var cache = {};

  for (var i = 0; i < expressions.length; i++) {
    lastExpression = i === expressions.length - 1;
    firstExpression = i === 0;
    expression = expressions[i]; // current expression

    matched = matchContextParts(cache, context, expression, 0);

    if (firstExpression) found = !lastExpression ? matched.slice() : matched;
    else spliceUnique(found, found.length, 0, matched);
  }

  // flatten result lists
  found.forEachRight(function(result, i) {
    if (result && result.isList) spliceUnique(found, i, 1, result);
  });

  return found;
}

function match(node, part, key) {

  var tag = normalize(part.tag);

  if (isPrimitive(node)) {

    if (part.id || part.classList || part.pseudos || part.attributes) return false;
    if (tag !== "*" && (key === undefined || key !== tag)) return false;
    return true;
  }

  // tag name: the key of the object.
  if (tag !== "*") {
    if (key === undefined) {
      var parentNode = node.parentNode;
      if (!parentNode) return false;
      key = parentNode.indexOf(node);
    }
    if (key === -1 || key === undefined || key !== tag) return false;
  }

  // id: same concept as domNode[id=x], except astNode[type=x].
  if (part.id) {
    var NodeClass = types[part.id];
    if (!NodeClass || !instanceOf(node, NodeClass)) return false;
  }

  var i;

  // className: node contains key, and is not null
  var classList = part.classList;
  if (classList) for (i = 0; i < classList.length; i++) {
    var className = classList[i];
    if (!(className in node)) return false;
  }

  var name, value;

  // attributes: check key and value
  var attributes = part.attributes;

  if (attributes) for (i = 0; i < attributes.length; i++) {
    var attribute = attributes[i];
    var operator = attribute.operator, escaped = attribute.escapedValue;
    name = attribute.name;

    value = normalize(attribute.value);

    if (!operator) {
      if (!(name in node)) return false;
    } else {

      var actual = node[name];

      if (operator !== "!=" && !isPrimitive(actual)) return false; // only match string representations

      switch (operator) {
        case "^=": if (!new RegExp("^" + escaped).test(actual)) return false; break;
        case "$=": if (!new RegExp(escaped + "$").test(actual)) return false; break;
        case "~=": if (!new RegExp("(^|\\s)" + escaped + "(\\s|$)").test(actual)) return false; break;
        case "|=": if (!new RegExp("^" + escaped + "(-|$)").test(actual)) return false; break;
        case "*=": if (actual.indexOf(value) === -1) return false; break;
        case "!=": if (actual === value) return false; break;
        case "=": if (actual !== value) return false; break;
        default: return false;
      }

    }
  }

  // pseudo selectors
  var pseudoSelectors = part.pseudos;

  if (pseudoSelectors) for (i = 0; i < pseudoSelectors.length; i++) {
    var pseudoSelector = pseudoSelectors[i];
    name = pseudoSelector.name;
    value = pseudoSelector.value;

    var pseudo = pseudos[name];
    if (pseudo && !pseudo(node, value)) return false;
  }

  return true;
}

var iterators = {

  // #Program #EmptyStatement
  " ": function(node, visitor) { // many children
    return node.traverse(function(value, key) {
      return visitor.call(node, value, key);
    }, true);
  },

  "~>": function(node, visitor) { // same as many children, but avoid block statements.
    return node.traverse(function(value, key, skip) {
      if (
        instanceOf(value, types.BlockStatement) ||
        instanceOf(value, types.ForInStatement) ||
        instanceOf(value, types.ForOfStatement) ||
        instanceOf(value, types.ForStatement)
      ) return skip;
      return visitor.call(node, value, key);
    }, true);
  },

  "=>": function(node, visitor) { // same as many children, but avoid functions.
    return node.traverse(function(value, key, skip) {
      if (instanceOf(value, types.Function)) return skip;
      return visitor.call(node, value, key);
    }, true);
  },

  ">>": function(node, visitor) { // same as many children, but avoid classes.
    return node.traverse(function(value, key, skip) {
      if (instanceOf(value, types.Class)) return skip;
      return visitor.call(node, value, key);
    }, true);
  },

  // #Program > body > #EmptyStatement
  ">": function(node, visitor) { // very direct children
    return node.traverse(function(value, key) {
      return visitor.call(node, value, key);
    });
  },

  // #EmptyStatement < body < #Program
  "<": function(node, visitor) { // direct parent
    var parentNode = node.parentNode;
    if (!parentNode) return undefined;
    var ancestor = parentNode.parentNode;
    return visitor.call(node, parentNode, ancestor && ancestor.indexOf(parentNode));
  },

  // #EmptyStatement ! #Program
  "!": function(node, visitor) { // wow, such parents
    var parentNode = node;
    while (parentNode = parentNode.parentNode) {
      var ancestor = parentNode.parentNode;
      var result = visitor.call(node, parentNode, ancestor && ancestor.indexOf(parentNode));
      if (result !== undefined) return result;
    }
  }

};

var pseudos = {

  reference: function(node, value) {
    if (node.type !== syntax.Identifier) return false;
    if (value && node.name !== value) return false;

    var parentNode, parent = node;

    while (parent = parent.parentNode) {
      if (parent.isNode) {
        parentNode = parent;
        break;
      }
    }

    if (!parentNode) return false;

    if (syntax.AssignmentExpression === parentNode.type)
      return parentNode.left === node || parentNode.right === node;

    if (syntax.ArrayExpression === parentNode.type)
      return !!~parentNode.elements.indexOf(node);

    if (syntax.BinaryExpression === parentNode.type)
      return parentNode.left === node || parentNode.right === node;

    if (syntax.CallExpression === parentNode.type)
      return parentNode.callee === node || !!~parentNode.arguments.indexOf(node);

    if (syntax.NewExpression === parentNode.type)
      return parentNode.callee === node || !!~parentNode.arguments.indexOf(node);

    if (syntax.ConditionalExpression === parentNode.type)
      return parentNode.test === node || parentNode.consequent === node || parentNode.alternate === node;

    if (syntax.DoWhileStatement === parentNode.type)
        return parentNode.test === node;

    if (syntax.ExpressionStatement === parentNode.type)
      return parentNode.expression === node;

    if (syntax.ForStatement === parentNode.type)
      return parentNode.init === node || parentNode.test === node || parentNode.update === node;

    if (syntax.ForInStatement === parentNode.type)
      return parentNode.left === node || parentNode.right === node;

    if (syntax.ForOfStatement === parentNode.type)
      return parentNode.left === node || parentNode.right === node;

    if (syntax.IfStatement === parentNode.type)
      return parentNode.right === node;

    if (syntax.LogicalExpression === parentNode.type)
      return parentNode.left === node || parentNode.right === node;

    if (syntax.MemberExpression === parentNode.type)
      return parentNode.object === node || parentNode.computed && parentNode.property === node;

    if (syntax.Property === parentNode.type)
      return parentNode.value === node;

    if (syntax.ReturnStatement === parentNode.type)
      return parentNode.argument === node;

    if (syntax.SequenceExpression === parentNode.type)
      return !!~parentNode.expressions.indexOf(node);

    if (syntax.SwitchStatement === parentNode.type)
      return parentNode.discriminant === node;

    if (syntax.SwitchCase === parentNode.type)
      return parentNode.test === node;

    if (syntax.ThrowStatement === parentNode.type)
      return parentNode.argument === node;

    if (syntax.UnaryExpression === parentNode.type)
      return parentNode.argument === node;

    if (syntax.UpdateExpression === parentNode.type)
      return parentNode.argument === node;

    if (syntax.VariableDeclarator === parentNode.type)
      return parentNode.init === node;

    if (syntax.WhileStatement === parentNode.type)
      return parentNode.test === node;

    if (syntax.WithStatement === parentNode.type)
      return parentNode.object === node;

    return false;
  },

  declaration: function(node, value) {
    if (node.type !== syntax.Identifier) return false;
    if (value && node.name !== value) return false;

    var parentNode, parent = node;

    while (parent = parent.parentNode) {
      if (parent.isNode) {
        parentNode = parent;
        break;
      }
    }

    if (!parentNode) return false;

    if (instanceOf(parentNode, types.Function)) {
      if (parentNode.id === node) return true;
      if (~parentNode.params.indexOf(node)) return true;

      return false;
    }

    if (syntax.RestElement === parentNode.type) {
      return parentNode.argument === node;
    }

    if (syntax.AssignmentPattern === parentNode.type) {
      return parentNode.left === node;
    }

    if (syntax.VariableDeclarator === parentNode.type) {
      return parentNode.id === node;
    }

    if (syntax.ArrayPattern === parentNode.type) {
      return !!~parentNode.elements.indexOf(node);
    }

    var list, listParent;

    if (syntax.Property === parentNode.type) {
      list = parentNode.parentNode;
      if (list && list.isList) {
        listParent = list.parentNode;
        if (listParent && listParent.type === syntax.ObjectPattern) return parentNode.value === node;
      }
    }

    return false;
  },

  scope: function(node) {
    return node.isNode && (node.type === syntax.Program || instanceOf(node, types.Function));
  }

};

var searchMethod = cw(function(expression) {
  return search(this, expression);
});

var parentMethod = cw(function(expression) {
  var parentNode = this;
  while (parentNode = parentNode.parentNode) {
    if (!expression || parentNode.matches(expression)) return parentNode;
  }
});

var scopeMethod = cw(function(expression) {
  var parentNode = this;
  while (parentNode = parentNode.parentNode) {
    if (pseudos.scope(parentNode) && (!expression || parentNode.matches(expression))) return parentNode;
  }
});

var matchesMethod = cw(function(expression) {
  var expressions = parse(expression);

  if (expressions.length === 1 && expressions[0].length === 1) { // simple match
    return match(this, expressions[0][0]);
  }

  var results = search(this.root, expression);

  for (var i = 0; i < results.length; i++) if (this === results[i]) return true;
  return false;
});

define(Node.prototype, "search", searchMethod);
define(Node.prototype, "parent", parentMethod);
define(Node.prototype, "matches", matchesMethod);
define(Node.prototype, "scope", scopeMethod);

define(BaseList.prototype, "search", searchMethod);
define(BaseList.prototype, "parent", parentMethod);
define(BaseList.prototype, "matches", matchesMethod);
define(BaseList.prototype, "scope", scopeMethod);

exports.iterators = iterators;
exports.pseudos = pseudos;
