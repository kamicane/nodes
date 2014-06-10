// slick finder, for the JavaScript AST
'use strict';

var parse = require('slick/parser');

var typeOf = require('./type-of');
var factory = require('./factory');
var nodes = require('./nodes');

var s = require('../syntax.json');

var List = factory.List;
var BaseList = factory.BaseList;
var Node = factory.Node;

var d = factory.d;

var define = Object.defineProperty;
var create = Object.create;

function isNative(value) {
  return (/^(Undefined|Null|String|RegExp|Boolean|Number)$/).test(typeOf(value));
}

function appendUnique(unique, list, values) {
  for (var i = 0; i < values.length; i++) {
    var value = values[i];

    if (isNative(value)) {
      list.push(value);
    } else if (!unique[value.uid]) {
      unique[value.uid] = true;
      list.push(value);
    }
  }
}

function search(context, expression, one) {

  var found = !one ? new BaseList : void 0, unique = {};

  var expressions = parse(expression);

  var filtered, filteredUnique, part, contexts, result;

  var pushUnique = function(value) {
    if (!List.test(value)) value = arguments;
    appendUnique(filteredUnique, filtered, value);
  };

  var getOne = function(value) { return value; };

  main: for (var i = 0; i < expressions.length; i++) {
    expression = expressions[i];

    contexts = [context]; // reset the base context for each expression

    for (var j = 0; j < expression.length; j++) {
      var isLast = j === expression.length - 1;

      part = expression[j];
      filtered = (one && isLast) ? void 0 : new BaseList;
      filteredUnique = {};
      result = void 0;

      for (var k = 0; k < contexts.length; k++) {
        var current = contexts[k];
        if (isNative(current)) continue main;

        result = combinators[part.combinator](current, part, one && isLast ? getOne : pushUnique);
        if (result !== void 0) break;
      }

      if (one && isLast) {
        if (result === void 0) continue main;
        else return result;
      }

      if (!filtered.length) continue main;
      if (!isLast) contexts = filtered;
    }

    if (!one) {
      if (i === 0) found = filtered;
      else appendUnique(unique, found, filtered);
    }

  }

  return found;
}

function match(node, key, part) {
  // tag name: the key of the object.
  if (part.tag !== '*' && part.tag !== key) return false;

  if (isNative(node) && (part.id || part.classList || part.pseudos || part.attributes)) return false;

  // id: same concept as domNode[id=x], except astNode[type=x]
  if (part.id && !(nodes[part.id].test(node))) return false;

  var i;

  // className: node contains key, and is not null
  var classList = part.classList;
  if (classList) for (i = 0; i < classList.length; i++) {
    if (node[classList[i]] == null) return false;
  }

  var name, value;

  // attributes: check key and value
  var attributes = part.attributes;

  if (attributes) for (i = 0; i < attributes.length; i++) {
    var attribute = attributes[i];
    var operator = attribute.operator, escaped = attribute.escapedValue;
    name = attribute.name;
    value = attribute.value;

    if (!operator) {
      if (!node[name]) return false;
    } else {

      var actual = node[name];

      if (!isNative(actual)) return false; // only match string representations

      switch (operator) {
        case '^=' : if (!new RegExp(      '^' + escaped            ).test(actual)) return false; break;
        case '$=' : if (!new RegExp(            escaped + '$'      ).test(actual)) return false; break;
        case '~=' : if (!new RegExp('(^|\\s)' + escaped + '(\\s|$)').test(actual)) return false; break;
        case '|=' : if (!new RegExp(      '^' + escaped + '(-|$)'  ).test(actual)) return false; break;
        case '*=' : if (actual.indexOf(value) === -1) return false; break;
        case '!=' : if (actual === value) return false; break;
        case '='  : if (actual !== value) return false; break;
        default   : return false;
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

var combinators = {

  // #Program #EmptyStatement
  ' ': function(node, part, push) { // many children
    return node.traverse(function(value, key) {
      if (match(value, key, part)) return push(value);
    }, true);
  },

  // #Program > body > #EmptyStatement
  '>': function(node, part, push) { // very direct children
    return node.traverse(function(value, key) {
      if (match(value, key, part)) return push(value);
    });
  },

  // #EmptyStatement < body < #Program
  '<': function(node, part, push) { // direct parent
    var parent = node.parentNode;
    if (parent && match(parent, parent.parentNode && parent.parentNode.indexOf(parent), part)) return push(parent);
  },

  // #EmptyStatement ! #Program
  '!': function(node, part, push) { // wow, such parents
    var parents = node.parents();
    return parents.traverse(function(parent) {
      if (match(parent, parent.parentNode && parent.parentNode.indexOf(parent), part)) return push(parent);
    });
  }

};

var pseudos = {

  reference: function(node, value) {
    if (node.type !== s.Identifier) return false;
    if (value && node.name !== value) return false;

    var parentNode, parent = node;

    while (parent = parent.parentNode) {
      if (Node.test(parent)) {
        parentNode = parent;
        break;
      }
    }

    if (!parentNode) return false;

    if (s.AssignmentExpression === parentNode.type)
      return parentNode.left === node || parentNode.right === node;

    if (s.ArrayExpression === parentNode.type)
      return !!~parentNode.elements.indexOf(node);

    if (s.BinaryExpression === parentNode.type)
      return parentNode.left === node || parentNode.right === node;

    if (s.CallExpression === parentNode.type)
      return parentNode.callee === node || !!~parentNode.arguments.indexOf(node);

    if (s.NewExpression === parentNode.type)
      return parentNode.callee === node || !!~parentNode.arguments.indexOf(node);

    if (s.ConditionalExpression === parentNode.type)
      return parentNode.test === node || parentNode.consequent === node || parentNode.alternate === node;

    if (s.DoWhileStatement === parentNode.type)
        return parentNode.test === node;

    if (s.ExpressionStatement === parentNode.type)
      return parentNode.expression === node;

    if (s.ForStatement === parentNode.type)
      return parentNode.init === node || parentNode.test === node || parentNode.update === node;

    if (s.ForInStatement === parentNode.type)
      return parentNode.left === node || parentNode.right === node;

    if (s.IfStatement === parentNode.type)
      return parentNode.right === node;

    if (s.LogicalExpression === parentNode.type)
      return parentNode.left === node || parentNode.right === node;

    if (s.MemberExpression === parentNode.type)
      return parentNode.object === node || parentNode.computed && parentNode.property === node;

    if (s.Property === parentNode.type)
      return parentNode.value === node;

    if (s.ReturnStatement === parentNode.type)
      return parentNode.argument === node;

    if (s.SequenceExpression === parentNode.type)
      return !!~parentNode.expressions.indexOf(node);

    if (s.SwitchStatement === parentNode.type)
      return parentNode.discriminant === node;

    if (s.SwitchCase === parentNode.type)
      return parentNode.test === node;

    if (s.ThrowStatement === parentNode.type)
      return parentNode.argument === node;

    if (s.UnaryExpression === parentNode.type)
      return parentNode.argument === node;

    if (s.UpdateExpression === parentNode.type)
      return parentNode.argument === node;

    if (s.VariableDeclarator === parentNode.type)
      return parentNode.init === node;

    if (s.WhileStatement === parentNode.type)
      return parentNode.test === node;

    if (s.WithStatement === parentNode.type)
      return parentNode.object === node;

    return false;
  },

  declaration: function(node, value) {
    if (node.type !== s.Identifier) return false;
    if (value && node.name !== value) return false;

    var parentNode, parent = node;

    while (parent = parent.parentNode) {
      if (Node.test(parent)) {
        parentNode = parent;
        break;
      }
    }

    if (!parentNode) return false;

    if (s.FunctionDeclaration === parentNode.type) {
      if (parentNode.id === node) return true;
    }

    if (nodes.Function.test(parentNode)) {
      return !!~parentNode.params.indexOf(node);
    }

    if (s.VariableDeclarator === parentNode.type) {
      return parentNode.id === node;
    }

    if (s.ArrayPattern === parentNode.type) {
      return !!~parentNode.elements.indexOf(node);
    }

    if (s.Property === parentNode.type && List.ObjectPatternProperties.test(parentNode.parentNode)) {
      return parentNode.value === node;
    }

    return false;
  },

  scope: function(node) {
    return node.type === s.Program || nodes.Function.test(node);
  }

};

var searchMe = d(function(expression) {
  return search(this, expression);
});

var findMe = d(function(expression) {
  return search(this, expression, true);
});

var parentMe = d(function(expression) {
  var parent = this;
  while (parent = parent.parentNode) {
    if (!expression || parent.matches(expression)) return parent;
  }
});

var scopeMe = d(function(expression) {
  var parentNode = this.parentNode;
  if (!parentNode) return;

  if (s.Identifier === this.type && s.FunctionDeclaration === parentNode.type && parentNode.id === this) {
    return parentNode.scope(expression);
  }

  var parent = this;
  while (parent = parent.parentNode) {
    if (pseudos.scope(parent) && (!expression || parent.matches(expression))) return parent;
  }
});

var parentsMe = d(function(expression) {
  var parent = this;
  var parents = new BaseList;
  while (parent = parent.parentNode) {
    if (!expression || parent.matches(expression)) parents.push(parent);
  }
  return parents;
});

var scopesMe = d(function(expression) {
  var parentNode = this.parentNode;
  var scopes = new BaseList;

  if (!parentNode) return scopes;

  if (s.Identifier === this.type && s.FunctionDeclaration === parentNode.type && parentNode.id === this) {
    return parentNode.scopes(expression);
  }

  var parent = this;
  while (parent = parent.parentNode) {
    if (pseudos.scope(parent) && (!expression || parent.matches(expression))) scopes.push(parent);
  }

  return scopes;
});

var matchesMe = d(function(expression) {
  var expressions = parse(expression);

  if (expressions.length === 1 && expressions[0].length === 1){ // simplest match
    return match(this, this.parentNode && this.parentNode.indexOf(this), expressions[0][0]);
  }

  var results = search(this.root, expression);

  for (var i = 0; i < results.length; i++) if (this === results[i]) return true;
  return false;
});

define(Node.prototype, 'search', searchMe);
define(Node.prototype, 'find', findMe);
define(Node.prototype, 'parent', parentMe);
define(Node.prototype, 'parents', parentsMe);
define(Node.prototype, 'matches', matchesMe);
define(Node.prototype, 'scope', scopeMe);
define(Node.prototype, 'scopes', scopesMe);

define(BaseList.prototype, 'search', searchMe);
define(BaseList.prototype, 'find', findMe);
define(BaseList.prototype, 'parent', parentMe);
define(BaseList.prototype, 'parents', parentsMe);
define(BaseList.prototype, 'matches', matchesMe);
define(BaseList.prototype, 'scope', scopeMe);
define(BaseList.prototype, 'scopes', scopesMe);

exports.combinators = combinators;
exports.pseudos = pseudos;
