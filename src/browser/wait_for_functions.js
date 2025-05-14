'use strict';
var __awaiter =
  (this && this.__awaiter) ||
  function (thisArg, _arguments, P, generator) {
    function adopt(value) {
      return value instanceof P
        ? value
        : new P(function (resolve) {
            resolve(value);
          });
    }
    return new (P || (P = Promise))(function (resolve, reject) {
      function fulfilled(value) {
        try {
          step(generator.next(value));
        } catch (e) {
          reject(e);
        }
      }
      function rejected(value) {
        try {
          step(generator['throw'](value));
        } catch (e) {
          reject(e);
        }
      }
      function step(result) {
        result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected);
      }
      step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
  };
var __generator =
  (this && this.__generator) ||
  function (thisArg, body) {
    var _ = {
        label: 0,
        sent: function () {
          if (t[0] & 1) throw t[1];
          return t[1];
        },
        trys: [],
        ops: [],
      },
      f,
      y,
      t,
      g = Object.create((typeof Iterator === 'function' ? Iterator : Object).prototype);
    return (
      (g.next = verb(0)),
      (g['throw'] = verb(1)),
      (g['return'] = verb(2)),
      typeof Symbol === 'function' &&
        (g[Symbol.iterator] = function () {
          return this;
        }),
      g
    );
    function verb(n) {
      return function (v) {
        return step([n, v]);
      };
    }
    function step(op) {
      if (f) throw new TypeError('Generator is already executing.');
      while ((g && ((g = 0), op[0] && (_ = 0)), _))
        try {
          if (
            ((f = 1),
            y &&
              (t =
                op[0] & 2
                  ? y['return']
                  : op[0]
                    ? y['throw'] || ((t = y['return']) && t.call(y), 0)
                    : y.next) &&
              !(t = t.call(y, op[1])).done)
          )
            return t;
          if (((y = 0), t)) op = [op[0] & 2, t.value];
          switch (op[0]) {
            case 0:
            case 1:
              t = op;
              break;
            case 4:
              _.label++;
              return { value: op[1], done: false };
            case 5:
              _.label++;
              y = op[1];
              op = [0];
              continue;
            case 7:
              op = _.ops.pop();
              _.trys.pop();
              continue;
            default:
              if (
                !((t = _.trys), (t = t.length > 0 && t[t.length - 1])) &&
                (op[0] === 6 || op[0] === 2)
              ) {
                _ = 0;
                continue;
              }
              if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) {
                _.label = op[1];
                break;
              }
              if (op[0] === 6 && _.label < t[1]) {
                _.label = t[1];
                t = op;
                break;
              }
              if (t && _.label < t[2]) {
                _.label = t[2];
                _.ops.push(op);
                break;
              }
              if (t[2]) _.ops.pop();
              _.trys.pop();
              continue;
          }
          op = body.call(thisArg, _);
        } catch (e) {
          op = [6, e];
          y = 0;
        } finally {
          f = t = 0;
        }
      if (op[0] & 5) throw op[1];
      return { value: op[0] ? op[1] : void 0, done: true };
    }
  };
Object.defineProperty(exports, '__esModule', { value: true });
var puppeteer_1 = require('puppeteer');
var signale_1 = require('signale');
var logger = new signale_1.default.Signale({
  config: {
    displayScope: false,
    displayBadge: true,
    displayDate: true,
    displayTimestamp: true,
    displayFilename: false,
    displayLabel: false,
  },
});
var browser = await puppeteer_1.default.launch({ headless: false });
var page = await browser.newPage();
await page.setViewport(null);
await page.goto('https://easyweb.td.com/');
page
  .waitForSelector('button.onetrust-close-btn-handler', { timeout: 0 })
  .then(function (elementHandle) {
    logger.info('Dismissing cookie dialog');
    elementHandle === null || elementHandle === void 0 ? void 0 : elementHandle.click();
  })
  .catch(function (error) {
    return logger.warn('Dismissing cookie dialog failed:', error);
  });
logger.await('Waiting for user to log in');
var statementsButton = await page.waitForFunction(
  function () {
    var spans = document.querySelectorAll('tduf-quick-link-item a span');
    for (var _i = 0, spans_1 = spans; _i < spans_1.length; _i++) {
      var span = spans_1[_i];
      if (span.innerText === 'Statements & Documents') {
        return span;
      }
    }
  },
  { timeout: 0 },
);
logger.await('Clicking statements button');
await statementsButton.click();
var selectAnAccountButton = await page.waitForFunction(
  function () {
    var spans = document.querySelectorAll('span.mat-select-placeholder');
    for (var _i = 0, spans_2 = spans; _i < spans_2.length; _i++) {
      var span = spans_2[_i];
      if (span.innerText === 'Select an account') {
        return span;
      }
    }
  },
  { timeout: 0 },
);
var accounts = await page.waitForFunction(
  function (selectAnAccountButton) {
    return __awaiter(void 0, void 0, void 0, function () {
      var spans;
      return __generator(this, function (_a) {
        switch (_a.label) {
          case 0:
            console.log('Clicking select an account button');
            return [4 /*yield*/, selectAnAccountButton.click()];
          case 1:
            _a.sent();
            spans = document.querySelectorAll('span.tduf-dropdown-chip-option-detail-primary');
            if (spans.length > 0) {
              return [2 /*return*/, spans];
            }
            return [2 /*return*/];
        }
      });
    });
  },
  { timeout: 0 },
  selectAnAccountButton,
);
var numAccounts = await accounts.evaluate(function (elementList) {
  return elementList.length;
});
logger.info('Found accounts: '.concat(numAccounts));
var accountNames = [];
for (var i = 0; i < numAccounts; i++) {
  var accountName = await accounts.evaluate(function (elementList, i) {
    return elementList[i].innerText;
  }, i);
  logger.info('Account #'.concat(i, ': ').concat(accountName));
  accountNames.push(accountName);
}
logger.info('Clicking account: '.concat(accountNames[0]));
accounts.evaluate(function (elementList) {
  elementList[0].click();
});
