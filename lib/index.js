'use strict';

var _extends2 = require('babel-runtime/helpers/extends');

var _extends3 = _interopRequireDefault(_extends2);

var _getPrototypeOf = require('babel-runtime/core-js/object/get-prototype-of');

var _getPrototypeOf2 = _interopRequireDefault(_getPrototypeOf);

var _classCallCheck2 = require('babel-runtime/helpers/classCallCheck');

var _classCallCheck3 = _interopRequireDefault(_classCallCheck2);

var _createClass2 = require('babel-runtime/helpers/createClass');

var _createClass3 = _interopRequireDefault(_createClass2);

var _possibleConstructorReturn2 = require('babel-runtime/helpers/possibleConstructorReturn');

var _possibleConstructorReturn3 = _interopRequireDefault(_possibleConstructorReturn2);

var _inherits2 = require('babel-runtime/helpers/inherits');

var _inherits3 = _interopRequireDefault(_inherits2);

var _lodash = require('lodash');

var _lodash2 = _interopRequireDefault(_lodash);

var _bluebird = require('bluebird');

var _bluebird2 = _interopRequireDefault(_bluebird);

var _fs = require('fs');

var _fs2 = _interopRequireDefault(_fs);

var _migration2 = require('./migration');

var _migration3 = _interopRequireDefault(_migration2);

var _path = require('path');

var _path2 = _interopRequireDefault(_path);

var _events = require('events');

var _Storage = require('./storages/Storage');

var _Storage2 = _interopRequireDefault(_Storage);

var _JSONStorage = require('./storages/JSONStorage');

var _JSONStorage2 = _interopRequireDefault(_JSONStorage);

var _MongoDBStorage = require('./storages/MongoDBStorage');

var _MongoDBStorage2 = _interopRequireDefault(_MongoDBStorage);

var _SequelizeStorage = require('./storages/SequelizeStorage');

var _SequelizeStorage2 = _interopRequireDefault(_SequelizeStorage);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

/**
 * @class Umzug
 * @extends EventEmitter
 */
module.exports = function (_EventEmitter) {
  (0, _inherits3.default)(Umzug, _EventEmitter);

  /**
   * Constructs Umzug instance.
   *
   * @param {Object} [options]
   * @param {String} [options.storage='json'] - The storage. Possible values:
   * 'json', 'sequelize', an argument for `require()`, including absolute paths.
   * @param {function|false} [options.logging=false] - The logging function.
   * A function that gets executed every time migrations start and have ended.
   * @param {String} [options.upName='up'] - The name of the positive method
   * in migrations.
   * @param {String} [options.downName='down'] - The name of the negative method
   * in migrations.
   * @param {Object} [options.storageOptions] - The options for the storage.
   * Check the available storages for further details.
   * @param {Object} [options.migrations] -
   * @param {Array} [options.migrations.params] - The params that gets passed to
   * the migrations. Might be an array or a synchronous function which returns
   * an array.
   * @param {String} [options.migrations.path] - The path to the migrations
   * directory.
   * @param {RegExp} [options.migrations.pattern] - The pattern that determines
   * whether or not a file is a migration.
   * @param {Migration~wrap} [options.migrations.wrap] - A function that
   * receives and returns the to be executed function. This can be used to
   * modify the function.
   * @param {Migration~customResolver} [options.migrations.customResolver] - A
   * function that specifies how to get a migration object from a path. This
   * should return an object of the form { up: Function, down: Function }.
   * Without this defined, a regular javascript import will be performed.
   * @constructs Umzug
   */
  function Umzug() {
    var options = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : {};
    (0, _classCallCheck3.default)(this, Umzug);

    var _this = (0, _possibleConstructorReturn3.default)(this, (Umzug.__proto__ || (0, _getPrototypeOf2.default)(Umzug)).call(this));

    _this.options = (0, _extends3.default)({
      storage: 'json',
      storageOptions: {},
      logging: false,
      upName: 'up',
      downName: 'down'
    }, options);

    if (_this.options.logging && !_lodash2.default.isFunction(_this.options.logging)) {
      throw new Error('The logging-option should be either a function or false');
    }

    _this.options.migrations = (0, _extends3.default)({
      params: [],
      path: _path2.default.resolve(process.cwd(), 'migrations'),
      pattern: /^\d+[\w-]+\.js$/,
      wrap: function wrap(fun) {
        return fun;
      }
    }, _this.options.migrations);

    _this.storage = _this._initStorage();
    return _this;
  }

  /**
   * Executes given migrations with a given method.
   *
   * @param {Object}   [options]
   * @param {String[]} [options.migrations=[]]
   * @param {String}   [options.method='up']
   * @returns {Promise}
   */


  (0, _createClass3.default)(Umzug, [{
    key: 'execute',
    value: function execute() {
      var options = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : {};

      var self = this;

      options = (0, _extends3.default)({
        migrations: [],
        method: 'up'
      }, options);

      return _bluebird2.default.map(options.migrations, function (migration) {
        return self._findMigration(migration);
      }).then(function (migrations) {
        return (0, _extends3.default)({}, options, {
          migrations
        });
      }).then(function (options) {
        return _bluebird2.default.each(options.migrations, function (migration) {
          var name = _path2.default.basename(migration.file, _path2.default.extname(migration.file));
          var startTime = void 0;
          return self._wasExecuted(migration).catch(function () {
            return false;
          }).then(function (executed) {
            return typeof executed === 'undefined' ? true : executed;
          }).tap(function (executed) {
            if (!executed || options.method === 'down') {
              var fun = migration[options.method] || _bluebird2.default.resolve;
              var params = self.options.migrations.params;

              if (typeof params === 'function') {
                params = params();
              }

              if (options.method === 'up') {
                self.log('== ' + name + ': migrating =======');
                self.emit('migrating', name, migration);
              } else {
                self.log('== ' + name + ': reverting =======');
                self.emit('reverting', name, migration);
              }

              startTime = new Date();

              return fun.apply(migration, params);
            }
          }).then(function (executed) {
            if (!executed && options.method === 'up') {
              return _bluebird2.default.resolve(self.storage.logMigration(migration.file));
            } else if (options.method === 'down') {
              return _bluebird2.default.resolve(self.storage.unlogMigration(migration.file));
            }
          }).tap(function () {
            var duration = ((new Date() - startTime) / 1000).toFixed(3);
            if (options.method === 'up') {
              self.log('== ' + name + ': migrated (' + duration + 's)\n');
              self.emit('migrated', name, migration);
            } else {
              self.log('== ' + name + ': reverted (' + duration + 's)\n');
              self.emit('reverted', name, migration);
            }
          });
        });
      });
    }

    /**
     * Lists executed migrations.
     *
     * @returns {Promise.<Migration>}
     */

  }, {
    key: 'executed',
    value: function executed() {
      return _bluebird2.default.resolve(this.storage.executed()).bind(this).map(function (file) {
        return new _migration3.default(file);
      });
    }

    /**
     * Lists pending migrations.
     *
     * @returns {Promise.<Migration[]>}
     */

  }, {
    key: 'pending',
    value: function pending() {
      return this._findMigrations().bind(this).then(function (all) {
        return _bluebird2.default.join(all, this.executed());
      }).spread(function (all, executed) {
        var executedFiles = executed.map(function (migration) {
          return migration.file;
        });

        return all.filter(function (migration) {
          return executedFiles.indexOf(migration.file) === -1;
        });
      });
    }

    /**
     * Execute migrations up.
     *
     * If options is a migration name (String), it will be executed.
     * If options is a list of migration names (String[]), them will be executed.
     * If options is Object:
     * - { from: 'migration-1', to: 'migration-n' } - execute migrations in range.
     * - { migrations: [] } - execute migrations in array.
     *
     * @param {String|String[]|Object} options
     * @param {String}     [options.from] - The first migration to execute (exc).
     * @param {String}     [options.to] - The last migration to execute (inc).
     * @param {String[]}   [options.migrations] - List of migrations to execute.
     * @returns {Promise}
     */

  }, {
    key: 'up',
    value: function up(options) {
      return this._run('up', options, this.pending.bind(this));
    }

    /**
     * Execute migrations down.
     *
     * If options is a migration name (String), it will be executed.
     * If options is a list of migration names (String[]), them will be executed.
     * If options is Object:
     * - { from: 'migration-n', to: 'migration-1' } - execute migrations in range.
     * - { migrations: [] } - execute migrations in array.
     *
     * @param {String|String[]|Object} options
     * @param {String}     [options.from] - The first migration to execute (exc).
     * @param {String}     [options.to] - The last migration to execute (inc).
     * @param {String[]}   [options.migrations] - List of migrations to execute.
     * @returns {Promise}
     */

  }, {
    key: 'down',
    value: function down(options) {
      var getExecuted = function () {
        return this.executed().bind(this).then(function (migrations) {
          return migrations.reverse();
        });
      }.bind(this);

      if (typeof options === 'undefined' || _lodash2.default.isEqual(options, {})) {
        return getExecuted().bind(this).then(function (migrations) {
          return migrations[0] ? this.down(migrations[0].file) : _bluebird2.default.resolve([]);
        });
      } else {
        return this._run('down', options, getExecuted.bind(this));
      }
    }

    /**
     * Callback function to get migrations in right order.
     *
     * @callback Umzug~rest
     * @return {Promise.<Migration[]>}
     */

    /**
     * Execute migrations either down or up.
     *
     * If options is a migration name (String), it will be executed.
     * If options is a list of migration names (String[]), them will be executed.
     * If options is Object:
     * - { from: 'migration-1', to: 'migration-n' } - execute migrations in range.
     * - { migrations: [] } - execute migrations in array.
     *
     * @param {String} method - Method to run. Either 'up' or 'down'.
     * @param {String|String[]|Object} options
     * @param {String}     [options.from] - The first migration to execute (exc).
     * @param {String}     [options.to] - The last migration to execute (inc).
     * @param {String[]}   [options.migrations] - List of migrations to execute.
     * @param {Umzug~rest} [rest] - Function to get migrations in right order.
     * @returns {Promise}
     * @private
     */

  }, {
    key: '_run',
    value: function _run(method, options, rest) {
      if (typeof options === 'string') {
        return this._run(method, [options]);
      } else if (Array.isArray(options)) {
        return _bluebird2.default.resolve(options).bind(this).map(function (migration) {
          return this._findMigration(migration);
        }).then(function (migrations) {
          return method === 'up' ? this._arePending(migrations) : this._wereExecuted(migrations);
        }).then(function () {
          return this._run(method, { migrations: options });
        });
      }

      options = (0, _extends3.default)({
        to: null,
        from: null,
        migrations: null
      }, options || {});

      if (options.migrations) {
        return this.execute({
          migrations: options.migrations,
          method: method
        });
      } else {
        return rest().bind(this).then(function (migrations) {
          var result = _bluebird2.default.resolve().bind(this);

          if (options.to) {
            result = result.then(function () {
              // There must be a migration matching to options.to...
              return this._findMigration(options.to);
            }).then(function (migration) {
              // ... and it must be pending/executed.
              return method === 'up' ? this._isPending(migration) : this._wasExecuted(migration);
            });
          }

          return result.then(function () {
            return _bluebird2.default.resolve(migrations);
          });
        }).then(function (migrations) {
          if (options.from) {
            return this._findMigrationsFromMatch(options.from, method);
          } else {
            return migrations;
          }
        }).then(function (migrations) {
          return this._findMigrationsUntilMatch(options.to, migrations);
        }).then(function (migrationFiles) {
          return this._run(method, { migrations: migrationFiles });
        });
      }
    }

    /**
     * Lists pending/executed migrations depending on method from a given
     * migration excluding it.
     *
     * @param {String} from - Migration name to be searched.
     * @param {String} method - Either 'up' or 'down'. If method is 'up', only
     * pending migrations will be accepted. Otherwise only executed migrations
     * will be accepted.
     * @returns {Promise.<Migration[]>}
     * @private
     */

  }, {
    key: '_findMigrationsFromMatch',
    value: function _findMigrationsFromMatch(from, method) {
      // We'll fetch all migrations and work our way from start to finish
      return this._findMigrations().bind(this).then(function (migrations) {
        var found = false;
        return migrations.filter(function (migration) {
          if (migration.testFileName(from)) {
            found = true;
            return false;
          }
          return found;
        });
      }).filter(function (fromMigration) {
        // now check if they need to be run based on status and method
        return this._wasExecuted(fromMigration).then(function () {
          if (method === 'up') {
            return false;
          } else {
            return true;
          }
        }).catch(function () {
          if (method === 'up') {
            return true;
          } else {
            return false;
          }
        });
      });
    }

    /**
     * Pass message to logger if logging is enabled.
     *
     * @param {*} message - Message to be logged.
     */

  }, {
    key: 'log',
    value: function log(message) {
      if (this.options.logging) {
        this.options.logging(message);
      }
    }

    /**
     * Try to require and initialize storage.
     *
     * @returns {*|SequelizeStorage|JSONStorage|Storage}
     * @private
     */

  }, {
    key: '_initStorage',
    value: function _initStorage() {
      if (typeof this.options.storage !== 'string') {
        return this.options.storage;
      }

      var StorageClass = void 0;
      try {
        StorageClass = this._getStorageClass();
      } catch (e) {
        throw new Error('Unable to resolve the storage: ' + this.options.storage + ', ' + e);
      }

      var storage = new StorageClass(this.options.storageOptions);
      if (_lodash2.default.has(storage, 'options.storageOptions')) {
        console.warn('Deprecated: Umzug Storage constructor has changed!', 'old syntax: new Storage({ storageOptions: { ... } })', 'new syntax: new Storage({ ... })', 'where ... represents the same storageOptions passed to Umzug constructor.', 'For more information: https://github.com/sequelize/umzug/pull/137');
        storage = new StorageClass(this.options);
      }

      return storage;
    }
  }, {
    key: '_getStorageClass',
    value: function _getStorageClass() {
      switch (this.options.storage) {
        case 'none':
          return _Storage2.default;
        case 'json':
          return _JSONStorage2.default;
        case 'mongodb':
          return _MongoDBStorage2.default;
        case 'sequelize':
          return _SequelizeStorage2.default;
        default:
          return require(this.options.storage);
      }
    }

    /**
     * Loads all migrations in ascending order.
     *
     * @returns {Promise.<Migration[]>}
     * @private
     */

  }, {
    key: '_findMigrations',
    value: function _findMigrations() {
      return _bluebird2.default.promisify(_fs2.default.readdir)(this.options.migrations.path).bind(this).filter(function (file) {
        if (!this.options.migrations.pattern.test(file)) {
          this.log('File: ' + file + ' does not match pattern: ' + this.options.migrations.pattern);
          return false;
        }
        return true;
      }).map(function (file) {
        return _path2.default.resolve(this.options.migrations.path, file);
      }).map(function (path) {
        return new _migration3.default(path, this.options);
      }).then(function (migrations) {
        return migrations.sort(function (a, b) {
          if (a.file > b.file) {
            return 1;
          } else if (a.file < b.file) {
            return -1;
          } else {
            return 0;
          }
        });
      });
    }

    /**
     * Gets a migration with a given name.
     *
     * @param {String} needle - Name of the migration.
     * @returns {Promise.<Migration>}
     * @private
     */

  }, {
    key: '_findMigration',
    value: function _findMigration(needle) {
      return this._findMigrations().then(function (migrations) {
        return migrations.filter(function (migration) {
          return migration.testFileName(needle);
        })[0];
      }).then(function (migration) {
        if (migration) {
          return migration;
        } else {
          return _bluebird2.default.reject(new Error('Unable to find migration: ' + needle));
        }
      });
    }

    /**
     * Checks if migration is executed. It will success if and only if there is
     * an executed migration with a given name.
     *
     * @param {String} _migration - Name of migration to be checked.
     * @returns {Promise}
     * @private
     */

  }, {
    key: '_wasExecuted',
    value: function _wasExecuted(_migration) {
      return this.executed().filter(function (migration) {
        return migration.testFileName(_migration.file);
      }).then(function (migrations) {
        if (migrations[0]) {
          return _bluebird2.default.resolve();
        } else {
          return _bluebird2.default.reject(new Error('Migration was not executed: ' + _migration.file));
        }
      });
    }

    /**
     * Checks if a list of migrations are all executed. It will success if and
     * only if there is an executed migration for each given name.
     *
     * @param {String[]} migrationNames - List of migration names to be checked.
     * @returns {Promise}
     * @private
     */

  }, {
    key: '_wereExecuted',
    value: function _wereExecuted(migrationNames) {
      return _bluebird2.default.resolve(migrationNames).bind(this).map(function (migration) {
        return this._wasExecuted(migration);
      });
    }

    /**
     * Checks if migration is pending. It will success if and only if there is
     * a pending migration with a given name.
     *
     * @param {String} _migration - Name of migration to be checked.
     * @returns {Promise}
     * @private
     */

  }, {
    key: '_isPending',
    value: function _isPending(_migration) {
      return this.pending().filter(function (migration) {
        return migration.testFileName(_migration.file);
      }).then(function (migrations) {
        if (migrations[0]) {
          return _bluebird2.default.resolve();
        } else {
          return _bluebird2.default.reject(new Error('Migration is not pending: ' + _migration.file));
        }
      });
    }

    /**
     * Checks if a list of migrations are all pending. It will success if and only
     * if there is a pending migration for each given name.
     *
     * @param {String[]} migrationNames - List of migration names to be checked.
     * @returns {Promise}
     * @private
     */

  }, {
    key: '_arePending',
    value: function _arePending(migrationNames) {
      return _bluebird2.default.resolve(migrationNames).bind(this).map(function (migration) {
        return this._isPending(migration);
      });
    }

    /**
     * Skip migrations in a given migration list after `to` migration.
     *
     * @param {String} to - The last one migration to be accepted.
     * @param {Migration[]} migrations - Migration list to be filtered.
     * @returns {Promise.<String>} - List of migrations before `to`.
     * @private
     */

  }, {
    key: '_findMigrationsUntilMatch',
    value: function _findMigrationsUntilMatch(to, migrations) {
      return _bluebird2.default.resolve(migrations).map(function (migration) {
        return migration.file;
      }).reduce(function (acc, migration) {
        if (acc.add) {
          acc.migrations.push(migration);

          if (to && migration.indexOf(to) === 0) {
            // Stop adding the migrations once the final migration
            // has been added.
            acc.add = false;
          }
        }

        return acc;
      }, { migrations: [], add: true }).get('migrations');
    }
  }]);
  return Umzug;
}(_events.EventEmitter);