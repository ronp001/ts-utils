"use strict";

var _interopRequireDefault = require("@babel/runtime/helpers/interopRequireDefault");

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.StrUtils = void 0;

var _classCallCheck2 = _interopRequireDefault(require("@babel/runtime/helpers/classCallCheck"));

var _createClass2 = _interopRequireDefault(require("@babel/runtime/helpers/createClass"));

var StrUtils =
/*#__PURE__*/
function () {
  function StrUtils() {
    (0, _classCallCheck2.default)(this, StrUtils);
  }

  (0, _createClass2.default)(StrUtils, null, [{
    key: "canonize",
    value: function canonize(str) {
      return str.replace(/_/g, '').replace(/-/g, '').replace(/\s/g, '').toLowerCase();
    }
  }, {
    key: "isSimilar",
    value: function isSimilar(str1, str2) {
      return StrUtils.canonize(str1) == StrUtils.canonize(str2);
    }
  }]);
  return StrUtils;
}();

exports.StrUtils = StrUtils;