// slick finder, for the JavaScript AST
'use strict';

var parse = require('slick/parser');

var factory = require('./factory');
var typeOf = require('../util/type-of');
var types = require('../types');
var syntax = require('../syntax.json');

var List = factory.List;
var BaseList = factory.BaseList;
var Node = factory.Node;

var d = factory.d;

// var slice = Array.prototype.slice;

var define = Object.defineProperty;

function isPrimitive(value) {
  return (/^(Undefined|Null|String|RegExp|Boolean|Number)$/).test(typeOf(value));
}

function spliceUnique(list, atIndex, howMany, values) {
  var accepted = [];
  for (var i = 0; i < values.length; i++) {
    var value = values[i];
    if (isPrimitive(value) || !~list.indexOf(value)) accepted.push(value);
  }
  if (accepted.length) list.splice.apply(list, [atIndex, howMany].concat(accepted));
  else if (howMany) list.splice(atIndex, howMany); // a list that contained only duplicate items needs to be removed.
  return list;
}

function search(context, expression, findOne) {

  var found;

  var expressions = parse(expression);

  var filtered, matched;
  var part, contexts;
  var lastPart, lastExpression, firstExpression;
  var expressionString;
  var cache = {};

  var manyExpressions = expressions.length > 1;

  main: for (var i = 0; i < expressions.length; i++) {
    lastExpression = i === expressions.length - 1;
    firstExpression = i === 0;

    expression = expressions[i]; // current expression

    contexts = [context]; // reset the base context for each expression

    for (var j = 0; j < expression.length; j++) {
      lastPart = j === expression.length - 1;
      part = expression[j];

      // expression string for caches
      expressionString = [];
      for (var p = 0; p <= j; p++) {
        var c = expression[p];
        if (c.combinator !== ' ') expressionString.push(c.combinator);
        expressionString.push(c.toString());
      }
      expressionString = expressionString.join(' ');

      if (cache[expressionString]) {
        filtered = cache[expressionString];
      } else {
        filtered = new BaseList;

        for (var k = 0; k < contexts.length; k++) {
          var current = contexts[k];
          if (isPrimitive(current)) continue main; // do not iterate over primitive values, break.

          matched = [];

          iterators[part.combinator](current, function(node, key) {
            if (match(node, key, part)) {
              matched.push(node);
            }
          });

          if (matched.length) spliceUnique(filtered, filtered.length, 0, matched);
        }

        cache[expressionString] = filtered;
      }

      if (!filtered.length) break; // breaks the expression.
      contexts = filtered; // use filtered as contexts
    }

    // use the first filtered and unique if it is the first expression
    if (firstExpression) found = manyExpressions ? filtered.slice() : filtered;
    else spliceUnique(found, found.length, 0, filtered);

    // flatten result lists
    found.forEachRight(function(result, i) {
      if (List.test(result)) spliceUnique(found, i, 1, result);
    });
  }

  return found;
}

function match(node, key, part) {
  // tag name: the key of the object.
  if (part.tag !== '*' && part.tag !== key) return false;

  if (isPrimitive(node) && (part.id || part.classList || part.pseudos || part.attributes)) return false;

  // id: same concept as domNode[id=x], except astNode[type=x].
  if (part.id) {
    var NodeClass = types[part.id];
    if (!NodeClass || !NodeClass.test(node)) return false;
  }

  var i;

  // className: node contains key, and is not null
  var classList = part.classList;
  if (classList) for (i = 0; i < classList.length; i++) {
    if (node[classList[i]] === void 0) return false;
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

      if (!isPrimitive(actual)) return false; // only match string representations

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

var iterators = {

  // #Program #EmptyStatement
  ' ': function(node, visitor) { // many children
    return node.traverse(function(value, key) {
      return visitor.call(node, value, key);
    }, true);
  },

  // #Program > body > #EmptyStatement
  '>': function(node, visitor) { // very direct children
    return node.traverse(function(value, key) {
      return visitor.call(node, value, key);
    });
  },

  // #EmptyStatement < body < #Program
  '<': function(node, visitor) { // direct parent
    var parentNode = node.parentNode;
    if (!parentNode) return;
    var ancestor = parentNode.parentNode;
    return visitor.call(node, parentNode, ancestor && ancestor.indexOf(parentNode));
  },

  // #EmptyStatement ! #Program
  '!': function(node, visitor) { // wow, such parents
    var parentNode = this;
    while (parentNode = parentNode.parentNode) {
      var ancestor = parentNode.parentNode;
      var result = visitor.call(node, parentNode, ancestor && ancestor.indexOf(parentNode));
      if (result !== void 0) return result;
    }
  }

};

var pseudos = {

  reference: function(node, value) {
    if (node.type !== syntax.Identifier) return false;
    if (value && node.name !== value) return false;

    var parentNode, parent = node;

    while (parent = parent.parentNode) {
      if (Node.test(parent)) {
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
      if (Node.test(parent)) {
        parentNode = parent;
        break;
      }
    }

    if (!parentNode) return false;

    if (syntax.FunctionDeclaration === parentNode.type) {
      if (parentNode.id === node) return true;
    }

    if (types.Function.test(parentNode)) {
      return !!~parentNode.params.indexOf(node);
    }

    if (syntax.VariableDeclarator === parentNode.type) {
      return parentNode.id === node;
    }

    if (syntax.ArrayPattern === parentNode.type) {
      return !!~parentNode.elements.indexOf(node);
    }

    if (syntax.Property === parentNode.type && List.ObjectPatternProperties.test(parentNode.parentNode)) {
      return parentNode.value === node;
    }

    return false;
  },

  scope: function(node) {
    return node.type === syntax.Program || types.Function.test(node);
  }

};

var searchMe = d(function(expression) {
  return search(this, expression);
});

// var findMe = d(function(expression) {
//   return search(this, expression, true);
// });

var parentMe = d(function(expression) {
  var parent = this;
  while (parent = parent.parentNode) {
    if (!expression || parent.matches(expression)) return parent;
  }
});

var scopeMe = d(function(expression) {
  var parentNode = this.parentNode;
  if (!parentNode) return;

  if (syntax.Identifier === this.type && syntax.FunctionDeclaration === parentNode.type && parentNode.id === this) {
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

  if (syntax.Identifier === this.type && syntax.FunctionDeclaration === parentNode.type && parentNode.id === this) {
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
// define(Node.prototype, 'find', findMe);
define(Node.prototype, 'parent', parentMe);
define(Node.prototype, 'parents', parentsMe);
define(Node.prototype, 'matches', matchesMe);
define(Node.prototype, 'scope', scopeMe);
define(Node.prototype, 'scopes', scopesMe);

define(BaseList.prototype, 'search', searchMe);
// define(BaseList.prototype, 'find', findMe);
define(BaseList.prototype, 'parent', parentMe);
define(BaseList.prototype, 'parents', parentsMe);
define(BaseList.prototype, 'matches', matchesMe);
define(BaseList.prototype, 'scope', scopeMe);
define(BaseList.prototype, 'scopes', scopesMe);

exports.iterators = iterators;
exports.pseudos = pseudos;
