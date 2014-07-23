var redis = require('redis'),
  request = require('request'),
  uuid = require('node-uuid'),
  _ = require('underscore'),
  db = redis.createClient(6379, '127.0.0.1', {
    no_ready_check: true
  }),
  balanced_lib = require('balanced-official');
/*!
Note
  options = {
    company: "..."
  };
  company is uuid of user account.  That account (uuid) represents the merchant.
*/
function BalancedAchCrowdfund(options) {
  this.config = {
    domain: null,
    marketplace_uri: null,
    marketplace_secret: null
  };
  if (options) _.extend(this.config, options);
  //Look up db, and get API keys
  /*
  Marketplace info
  URI
  /v1/marketplaces/TEST-MP79UVAfUTYsx8vucWv0R6LQ
  API key secret
  eb0cc008206c11e3b531026ba7f8ec28
  */
  this.api = new balanced_lib({
    marketplace_uri: this.config.marketplace_uri,
    secret: this.config.marketplace_secret
  });
}
BalancedAchCrowdfund.prototype.getNextUUID = function() {
  var buffer = new Buffer(16);
  uuid.v4({
    rng: uuid.nodeRNG
  }, buffer, 0);
  return uuid.unparse(buffer)
    .replace(/-/g, '');
};
BalancedAchCrowdfund.prototype.addVerificationsLog = function(newrec) {
  var _uuid = this.getNextUUID();
  db.hmset(_uuid, newrec);
  db.lpush(this.config.domain + ':balanced:verifications:log', _uuid);
  db.lpush(this.config.domain + ':' + this.options.email + ':balanced:verifications:log', _uuid);
};
BalancedAchCrowdfund.prototype.getCustomer = function() {
  var self = this;
  db.hget(self.config.domain + ':balanced:customer:' + self.options.email, 'uri', function(err, uri) {
    if (err || !uri) {
      //Create one
      return self.createCustomer();
    }
    db.hget(self.config.domain + ':balanced:bankaccount:' + self.options.email, 'uri', function(err, bank_uri) {
      if (err || !bank_uri) {
        //Pass the customer uri
        self.addBankAccount(uri);
      } else {
        //console.log('Account already exists');
        self.updateBankAccount(bank_uri);
      }
    });
  });
}
BalancedAchCrowdfund.prototype.createCustomer = function() {
    var self = this;
    self.api.Customers.create({
      name: this.options.name || this.options.email,
      email: this.options.email,
      meta: {
        accountType: this.options.type
      }
    }, function(err, newCustomer) {
      if (err || !newCustomer) return self.options.callback({
        error: 'Failed to create customer'
      });
      db.hmset(self.config.domain + ':balanced:customer:' + self.options.email, newCustomer);
      //console.log('Account created successfully');
      self.addBankAccount(newCustomer.uri);
    });
  }
  /*!
    At a minimum, options should include
    var options = {
    email: email,
    name: "Nightcrawler Jazzy",
    account_number: "026012881",
    routing_number: "121000359",
    type: "checking",
    user_type: 'investor'
    };
  */
BalancedAchCrowdfund.prototype.addBankAccount = function(customerUri) {
  var self = this;
  //Create the bank account
  var bankInfo = _.pick(this.options, 'name', 'account_number', 'routing_number', 'type', 'user_type', 'email');
  this.api.BankAccounts.create(bankInfo, function(err, bank) {
    if (err || !bank) {
      return self.options.callback({
        error: 'Failed to add new bank account'
      });
    }
    //Associate it with the account
    self.api.Customers.addBankAccount(customerUri, bank.uri, function(err, added_bank) {
      if (err || !added_bank) {
        return self.options.callback({
          error: 'Failed to add associate bank account to customer'
        });
      }
      //Immediately verify?
      self.api.BankAccounts.verify(bank.verifications_uri, function(err, result) {
        // ** Add to a collection so cron can easily find which user needs to get reminder emails
        db.zadd('balanced:bankaccount:confirm:pending', new Date()
          .setHours(0, 0, 0, 0), self.config.domain + ':' + self.options.email);
        //Verifications log
        self.addVerificationsLog({
          now: Date.now(),
          state: result.state,
          email: self.options.email,
          name: self.options.name
        });
        //Now there's a verification_uri created, add record to database
        self.api.BankAccounts.get(bank.uri, function(err, updatedBank) {
          if (err || !updatedBank) {
            return self.options.callback({
              error: 'Failed to retrieve bank account'
            });
          }
          //Add to database
          db.hmset(self.config.domain + ':balanced:bankaccount:' + self.options.email, updatedBank);
          //console.log('Added bank account');
          self.options.callback(null, updatedBank);
        });
      });
    });
  });
}
BalancedAchCrowdfund.prototype.updateBankAccount = function(bankUri) {
  var bankInfo = _.pick(this.options, 'name', 'account_number', 'routing_number', 'type'),
    self = this;
  self.api.BankAccounts.update(bankUri, bankInfo, function(err, updatedBank) {
    if (err || !updatedBank) {
      return self.options.callback({
        error: 'Error occured while updating bank account'
      });
    }
    db.hmset(self.config.domain + ':balanced:bankaccount:' + self.options.email, updatedBank);
    //console.log('Updated bank account');
    self.options.callback(null, updatedBank);
  });
}
BalancedAchCrowdfund.prototype.saveBankAccount = function(options) {
    if (!this.options) this.options = {};
    if (options) _.extend(this.options, options);
    this.getCustomer();
  }
  //Run this 1 minute after the expiration date 12:01am 
BalancedAchCrowdfund.prototype.debitBankAccount = function(options) {
    if (!this.options) this.options = {};
    if (options) _.extend(this.options, options);
    var self = this,
      multi = db.multi();
    /*
      If this campaign were to be debited, it should have been removed from marketplace:campaigns
    */
    multi.hget(this.config.domain + ':balanced:customer:' + this.options.email, 'uri');
    multi.hget(this.config.domain + ':balanced:bankaccount:' + this.options.email, 'uri');
    multi.hgetall(this.config.domain + ':' + this.options.email);
    multi.exec(function(err, arr) {
      if (!arr || arr.length < 3 || !arr[0] || !arr[1] || !arr[2]) return self.options.callback({
        error: 'Error occurred initializing debit for ' + self.options.campaignId
      });
      /*
      if (+arr[0] === 1)
        return self.options.callback({error: self.options.campaignId + ' is not in debited state'});
      */
      var customer_uri = arr[0],
        bank_uri = arr[1],
        source_uri = '/v1/bank_accounts/' + bank_uri.split('/')
        .pop(),
        url = 'https://api.balancedpayments.com' + customer_uri + '/debits',
        modMerchantName = self.options.merchantName.replace(/,/g, '')
        .slice(0, 22);
      data = {
          source_uri: source_uri,
          amount: self.options.amount,
          description: self.options.campaignName,
          on_behalf_of: modMerchantName,
          appears_on_statement_as: modMerchantName,
          meta: self.options
        },
        headers = {
          "content-type": "application/json",
          "content-length": JSON.stringify(data)
            .length,
          "accept": "*/*"
        };
      var reqObj = {
        auth: {
          user: self.api.Debits._secret + ':'
        },
        url: url,
        headers: headers
      };
      request.post(reqObj, function(error, response, json) {
          var now = Date.now(),
            midnite = new Date()
            .setHours(0, 0, 0, 0);
          if (!error && (response.statusCode.toString()
            .search(/^200|201$/) != -1)) {
            try {
              _.each(json.meta, function(v, k) {
                json[k] = v;
              });
              json.now = now;
            } catch (e) {}
            db.hmset(json.uri, json);
            var options = self.options;
            //Marketplace
            db.incrby(self.config.domain + ':balanced:debits:total', options.amount);
            db.lpush(self.config.domain + ':balanced:debits:urls', json.uri);
            db.zincrby(self.config.domain + ':balanced:debits:users', options.amount, options.email);
            db.zincrby(self.config.domain + ':balanced:debits:campaigns', options.amount, options.campaignId);
            db.zincrby(self.config.domain + ':balanced:debits:day', options.amount, midnite);
            //Merchant
            db.incrby(options.merchant + ':balanced:debits:total', options.amount);
            db.lpush(options.merchant + ':balanced:debits:urls', json.uri);
            db.zincrby(options.merchant + ':balanced:debits:users', options.amount, options.email);
            db.zincrby(options.merchant + ':balanced:debits:campaigns', options.amount, options.campaignId);
            db.zincrby(options.merchant + ':balanced:debits:day', options.amount, midnite);
            //Campaign
            db.incrby(options.campaignId + ':balanced:debits:total', options.amount);
            db.lpush(options.campaignId + ':balanced:debits:urls', json.uri);
            db.zincrby(options.campaignId + ':balanced:debits:users', options.amount, options.email);
            db.zincrby(options.campaignId + ':balanced:debits:day', options.amount, midnite);
            //User
            db.incrby(self.config.domain + ':' + options.email + ':balanced:debits:total', options.amount);
            db.lpush(self.config.domain + ':' + options.email + ':balanced:debits:urls', json.uri);
            db.zincrby(self.config.domain + ':' + options.email + ':balanced:debits:campaigns', options.amount, options.campaignId);
            db.zincrby(self.config.domain + ':' + options.email + ':balanced:debits:day', options.amount, midnite);
            self.options.callback(null, json);
          } else {
            //Status Code 411 Length required
            var buffer = new Buffer(16);
            uuid.v4({
              rng: uuid.nodeRNG
            }, buffer, 0);
            var _uuid = uuid.unparse(buffer)
              .replace(/-/g, '');
            var newrec = {
              now: now,
              category_code: json.category_code,
              description: json.description,
              merchantName: self.options.merchantName,
              campaignId: self.options.campaignId,
              campaignName: self.options.campaignName,
              email: self.options.email,
              name: self.options.name,
              amount: self.options.amount
            };
            hmset(_uuid, newrec);
            //Marketplace
            db.lpush(self.config.domain + ':balanced:debits:errorlog', _uuid);
            //Merchant
            db.lpush(self.options.merchant + ':balanced:debits:errorlog', _uuid);
            //Campaign
            db.lpush(self.options.campaignId + ':balanced:debits:errorlog', _uuid);
            //User
            db.lpush(self.config.domain + ':' + self.options.email + ':balanced:debits:errorlog', _uuid);
            self.options.callback({
              error: 'Error ocurred during debit for campaign ' + self.options.campaignId + ' for ' + self.config.domain
            });
          }
        })
        .json(data);
    });
  }
  //Run this NEXT day after close of campaign
BalancedAchCrowdfund.prototype.creditBankAccount = function(options) {
    /*!
    [ null,
    409,
    '{\n  "status": "Conflict",\n  "category_code": "insufficient-funds",\n  "additional": null,\n  "status_code": 409,\n  "extras": {},\n  "category_type": "logical",\n  "_uris": {},\n  "request_id": "OHMa59ff50813c911e38643026ba7c1aba6",\n  "description": "Marketplace TEST-MP6h3Mnedq36ulGReVomHF7O has insufficient funds to cover a transfer of 1000 to destination BA184L9JRYamIXdRwG3uaIIw. Your request id is OHMa59ff50813c911e38643026ba7c1aba6."\n}' ]
    */
    if (!this.options) this.options = {};
    if (options) _.extend(this.options, options);
    var self = this;
    var multi = db.multi();
    multi.hget(this.config.domain + ':balanced:customer:' + this.options.email, 'uri');
    multi.hget(this.config.domain + ':balanced:bankaccount:' + this.options.email, 'uri');
    multi.exec(function(err, arr) {
      if (!arr || arr.length < 2 || !arr[0] || !arr[1]) return
      self.options.callback({
        error: 'Error occurred initializing credit for ' + self.options.campaignId
      });
      var customer_uri = arr[0],
        bank_uri = arr[1],
        source_uri = '/v1/bank_accounts/' + bank_uri.split('/')
        .pop(),
        url = 'https://api.balancedpayments.com' + customer_uri + '/credits',
        modMerchantName = self.options.merchantName.replace(/,/g, '')
        .slice(0, 22);
      data = {
          source_uri: source_uri,
          amount: self.options.amount,
          description: self.options.campaignName,
          on_behalf_of: modMerchantName,
          appears_on_statement_as: modMerchantName,
          meta: self.options
        },
        headers = {
          "content-type": "application/json",
          "content-length": JSON.stringify(data)
            .length,
          "accept": "*/*"
        };
      var reqObj = {
        auth: {
          user: self.api.Credits._secret + ':'
        },
        url: url,
        headers: headers
      };
      request.post(reqObj, function(error, response, json) {
          var now = Date.now(),
            midnite = new Date()
            .setHours(0, 0, 0, 0);
          if (!error && (response.statusCode.toString()
            .search(/^200|201$/) != -1)) {
            /*
              "status":"paid",
              "state":"cleared"
            */
            try {
              _.each(json.meta, function(v, k) {
                json[k] = v;
              });
              json.now = now;
            } catch (e) {}
            db.hmset(json.uri, json);
            //Marketplace
            db.incrby(self.config.domain + ':balanced:credits:total', options.amount);
            db.lpush(self.config.domain + ':balanced:credits:urls', json.uri);
            db.zincrby(self.config.domain + ':balanced:credits:campaigns', self.options.amount, self.options.campaignId);
            db.zincrby(self.config.domain + ':balanced:credits:day', self.options.amount, midnite);
            //Merchant
            db.incrby(self.options.merchant + ':balanced:credits:total', options.amount);
            db.lpush(self.options.merchant + ':balanced:credits:urls', json.uri);
            db.zincrby(self.options.merchant + ':balanced:credits:campaigns', self.options.amount, self.options.campaignId);
            db.zincrby(self.options.merchant + ':balanced:credits:day', self.options.amount, midnite);
            //Campaign
            db.incrby(options.campaignId + ':balanced:credits:total', options.amount);
            db.lpush(options.campaignId + ':balanced:credits:urls', json.uri);
            db.zincrby(options.campaignId + ':balanced:credits:users', options.amount, options.email);
            db.zincrby(options.campaignId + ':balanced:credits:day', options.amount, midnite);
            self.options.callback(null, json);
          } else {
            var buffer = new Buffer(16);
            uuid.v4({
              rng: uuid.nodeRNG
            }, buffer, 0);
            var _uuid = uuid.unparse(buffer)
              .replace(/-/g, '');
            var newrec = {
              now: now,
              category_code: json.category_code,
              description: json.description,
              merchantName: self.options.merchantName,
              campaignId: self.options.campaignId,
              campaignName: self.options.campaignName,
              email: self.options.email,
              name: self.options.name,
              amount: self.options.amount
            };
            db.hmset(_uuid, newrec);
            //insufficient funds is response.statusCode: 409
            //Marketplace
            db.lpush(self.config.domain + ':balanced:credits:errorlog', _uuid);
            //Merchant
            db.lpush(self.options.merchant + ':balanced:credits:errorlog', _uuid);
            //Campaign
            db.lpush(self.options.campaignId + ':balanced:credits:errorlog', _uuid);
            //User
            self.options.callback({
              error: 'Error ocurred during credit for campaign ' + self.options.campaignId + ' for ' + self.config.domain
            });
          }
        })
        .json(data);
    });
  }
  /*
  { status: 'Conflict',
    category_code: 'bank-account-authentication-failed',
    additional: null,
    status_code: 409,
    extras: {},
    category_type: 'logical',
    _uris: {},
    request_id: 'OHM10c6da0835e511e380c1026ba7d31e6f',
    description: 'Authentication amounts do not match. Your request id is OHM10c6da0835e511e380c1026ba7d31e6f.' 
   }
  */
  /*!
    Required: options.amount1, options.amount2
    It will say: "can_debit: true"
  */
BalancedAchCrowdfund.prototype.confirmBankAccount = function(options) {
  if (!this.options) this.options = {};
  if (options) _.extend(this.options, options);
  var self = this;
  db.hgetall(this.config.domain + ':balanced:bankaccount:' + this.options.email, function(err, bankaccount) {
    if (err || !bankaccount) {
      return self.options.callback({
        error: 'Error retrieving bank account'
      });
    }
    //DON'T CONFIRM AGAIN IF ALREADY CoNFIRMED
    if (bankaccount.can_debit == 'true') return self.options.callback(null, bankaccount);
    //verifications url
    self.api.BankAccounts.confirm(bankaccount.verification_uri, self.options.amount1, self.options.amount2, function(err, result) {
      function updateDb() {
        self.api.BankAccounts.get(bankaccount.uri, function(err, updatedBank) {
          if (err || !updatedBank) {
            return self.options.callback({
              error: 'Error retrieving bank account'
            });
          }
          db.hmset(self.config.domain + ':balanced:bankaccount:' + self.options.email, updatedBank);
          self.options.callback(null, updatedBank);
        });
      }
      var now = Date.now();
      if (err || !bankaccount) {
        /*!
          If confirms fails, need to verify again!
        */
        //Verifications log
        self.addVerificationsLog({
          now: Date.now(),
          state: err.category_code + ': ' + err.description,
          email: self.options.email,
          name: self.options.name
        });
        //If it's longer "pending", invoke a verify again (is this right?)
        //Noticed takes a few seconds before it gets back to pending status
        self.api.BankAccounts.verify(bankaccount.verifications_uri, function(err, result) {
          if (err) {
            return self.options.callback({
              error: 'Error while applying verify to bank account for ' + self.options.email
            });
          }
          //Add to a collection so cron can easily find which user needs to get reminder emails
          db.zadd('balanced:bankaccount:confirm:pending', new Date()
            .setHours(0, 0, 0, 0), self.config.domain + ':' + self.options.email);
        });
        //Update the bank account info anyway, probably need to verify again
        updateDb();
        return self.options.callback({
          error: 'Error occurred while confirming bank account'
        });
      } else {
        //Verifications log
        self.addVerificationsLog({
          now: Date.now(),
          state: result.state,
          email: self.options.email,
          name: self.options.name
        });
        //Update local
        updateDb();
        //Is state "verified"?  Don't send emails anymore
        if (result.state == "verified") db.zrem('balanced:bankaccount:confirm:pending', self.config.domain + ':' + self.options.email);
      }
    });
  });
}
BalancedAchCrowdfund.prototype.verifyBankAccount = function(options) {
  if (!this.options) this.options = {};
  if (options) _.extend(this.options, options);
  var self = this;
  db.hgetall(this.config.domain + ':balanced:bankaccount:' + this.options.email, function(err, bankaccount) {
    if (err || !bankaccount) {
      return self.options.callback({
        error: 'Error retrieving bank account'
      });
    }
    self.api.BankAccounts.verifications(bankaccount.verification_uri, function(err, result) {
      var now = Date.now();
      if (err || !result) {
        //Verifications log
        self.addVerificationsLog({
          now: Date.now(),
          state: err.category_code + ': ' + err.description,
          email: self.options.email,
          name: self.options.name
        });
        return self.options.callback({
          error: 'Error verifying bank account'
        });
      }
      //Verifications log
      self.addVerificationsLog({
        now: Date.now(),
        state: result.state + ': ' + err.description,
        email: self.options.email,
        name: self.options.name
      });
      if (result.state == "verified") {
        self.api.BankAccounts.get(bankaccount.uri, function(err, updatedBank) {
          if (err || !updatedBank) {
            return self.options.callback({
              error: 'Bank account verified but error updating bank account'
            });
          }
          //Update the bank account
          db.hmset(self.config.domain + ':balanced:bankaccount:' + self.options.email, updatedBank);
          self.options.callback(null, updatedBank);
        });
      } else {
        //Will say someting like 'pending', 'deposit_succeeded'
        self.options.callback({
          error: 'Bank account verification is ' + result.state + '.  Please confirm your bank account.'
        });
      }
    });
  });
}
BalancedAchCrowdfund.prototype.dumbo = function(options) {
  if (!this.options) this.options = {};
  if (options) _.extend(this.options, options);
  if (this.options.succeed) {
    //Test success
    this.options.callback(null, {
      status: 'success'
    });
  } else {
    //Test failure
    this.options.callback({
      error: 'Failed'
    });
  }
};
module.exports = exports = BalancedAchCrowdfund;