var redis = require('redis'),
  _ = require('underscore'),
  uuid = require('node-uuid'),
  BalancedAchCrowdfund = require('../lib/balanced-ach-crowdfund'),
  BalancedUnitTestsHelper = require('./balanced-unit-tests-helper'),
  db = redis.createClient(6379, 'localhost', {
    no_ready_check: true
  }),
  async = require('async');

/*
  HELPERS
*/
function generateUUID(howmany) {
  return _.map(_.range(howmany), function(i) {
    return uuid.v1({
        node: i % 2 == 0 ? [0x01, 0x23, 0x45, 0x67, 0x89, 0xab] : [0xba, 0x98, 0x76, 0x54, 0x32, 0x01],
        clockseq: i % 2 == 0 ? 0x1234 : 0x5678,
        msecs: i % 2 == 0 ? new Date('1969-12-31')
          .getTime() : new Date('1979-12-31')
          .getTime(),
        nsecs: i
      })
      .replace(/-/g, '');
  });
}

function getStaticUUID(i, offset) {
  i += 1;
  if (offset) i = i * (offset + 1);
  return uuid.v1({
      node: i % 2 == 0 ? [0x01, 0x23, 0x45, 0x67, 0x89, 0xab] : [0xba, 0x98, 0x76, 0x54, 0x32, 0x01],
      clockseq: i % 2 == 0 ? 0x1234 : 0x5678,
      msecs: i % 2 == 0 ? new Date('1969-12-31')
        .getTime() : new Date('1979-12-31')
        .getTime(),
      nsecs: i > 9999 ? 9999 - i : i
    })
    .replace(/-/g, '');
}

function createUser(email) {
  db.zadd(marketplace + ':users', 0, email);
  db.hmset(marketplace + ':' + email, {
    email: email
  });
  return true
}

function createTestBankInfo(email) {
  return {
    company: marketplace,
    email: email,
    name: "Nightcrawler Jazzy",
    account_number: "026012881",
    routing_number: "121000359",
    type: "checking",
    amount1: 1,
    amount2: 1,
    //user_type: 'investor',
    campaignId: '123456789abcdefg:offeringsummary:1',
    campaignName: 'My First Ever Campaign',
    amount: 50, //must be >= 50
    merchantName: 'Great Guy'
  };
}

function addToDebitCollection() {
  //Create the record in the list of campaigns to be credited
  db.sadd(marketplace + ':campaigns:debited', '123456789abcdefg:offeringsummary:1');
}

function saveBankAccount(bankinfo, callback) {
  db.hgetall(bankinfo.marketplace, function(err, marketplacedata) {
    var config = _.pick(marketplacedata, 'marketplace_uri', 'marketplace_secret')
    var bc = new BalancedAchCrowdfund(config);
    //Tack on the callback, else how would user know if succeeded or not?
    bankinfo.callback = callback;
    bc.saveBankAccount(bankinfo);
  });
}

function verifyBankAccount(bankinfo, callback) {
  db.hgetall(marketplace, function(err, marketplacedata) {
    var config = _.pick(marketplacedata, 'marketplace_uri', 'marketplace_secret')
    var bc = new BalancedAchCrowdfund(config);
    //Tack on the callback, else how would user know if succeeded or not?
    bankinfo.callback = callback;
    bc.verifyBankAccount(bankinfo);
  });
}

function confirmBankAccount(bankinfo, callback) {
    db.hgetall(bankinfo.marketplace, function(err, marketplacedata) {
      var config = _.pick(marketplacedata, 'domain', 'marketplace_uri', 'marketplace_secret')
      var bc = new BalancedAchCrowdfund(config);
      //Tack on the callback, else how would user know if succeeded or not?
      bankinfo.callback = callback;
      bc.confirmBankAccount(bankinfo);
    });
  }
  
//========================================================================================
/*!
	Credit
*/

function creditBankAccount(bankinfo, callback) {

  db.hgetall(marketplace, function(err, marketplacedata) {
    var config = _.pick(marketplacedata, 'marketplace_uri', 'marketplace_secret');
    //Add the marketplace itself (the domain)
    config.marketplace = marketplace;
    var bc = new BalancedAchCrowdfund(config);
    //Tack on the callback, else how would user know if succeeded or not?
    bankinfo.callback = callback;
    bc.creditBankAccount(bankinfo);
  });
}

/*!
	Debit
*/
function prereqForDebit(options) {
  /*!
		This is ultra important!
	*/
  //Remove from campaigns:expire (so cron will not look for it)
  db.zrem('balanced:campaigns:expire', options.campaignId, function(err, resp) {
    //if resp == 1, continue
    //else nothing to do
    if (resp == 1) {
      //Take this out of campaigns collection (so it won't get displayed in ) and move it to campaigns:debited collection
      db.zrem(options.marketplace + ':campaigns', options.campaignId);
      //Add to debited
      db.sadd(options.marketplace + ':campaigns:debited', options.campaignId);
      //We haven't actually debited anything yet
      //BUT this is safer to protect from the event we do debit more than once
      //Next we jump start the sweep
      if (options.callback) options.callback();
    }
  });
}

function debitBankAccount(bankinfo, callback) {
  db.hgetall(marketplace, function(err, marketplacedata) {
    var config = _.pick(marketplacedata, 'marketplace_uri', 'marketplace_secret');
    //Add the marketplace itself (the domain)
    config.marketplace = marketplace;
    var bc = new BalancedAchCrowdfund(config);
    //Tack on the callback, else how would user know if succeeded or not?
    bankinfo.callback = callback;
    bc.debitBankAccount(bankinfo);
  });
}
/*!
	End Debit
*/
  
//========================================================================================
//-------------------------------------------------------------------------------------------------------
//TESTS

describe('Save bank account', function testSaveBankAccount() {
  
    createMarketPlace();
    createUser('hJazzyx@hotmail.com');    
    var bankinfo = createTestBankInfo('hJazzyx@hotmail.com');
    var callbackBankInfo;

    before(function(done){
      saveBankAccount(bankinfo, function(err, bi) {
        callbackBankInfo = bi;
        done();
      });
    });

    it('should be an object',function(){
      callbackBankInfo.should.be.an.instanceOf(Object);
    });

  }

});

describe('Save bank account',  function testVerifyBankAccount() {

  createMarketPlace();
  createUser('hJazzyx@hotmail.com');
  var bankinfo = createTestBankInfo('hJazzyx@hotmail.com');
  
  var callbackError;

  before(function(done){
    verifyBankAccount(bankinfo, function(err, bi) {
      callbackError=err;
      done();
    });
  });

  it('should not be an object',function(){
    callbackError.should.not.be.an.instanceOf(Object);
  });

});

function testConfirmBankAccount() {
  createMarketPlace();
  createUser('hJazzyx@hotmail.com');
  var bankinfo = createTestBankInfo('hJazzyx@hotmail.com');
  confirmBankAccount(bankinfo, console.log);
}

function testCreditBankAccount() {
  addToDebitCollection();
  createMarketPlace();
  createUser('hJazzyx@hotmail.com');
  var bankinfo = createTestBankInfo('hJazzyx@hotmail.com');
  creditBankAccount(bankinfo, console.log);
}

function testDebitBankAccount() {
  function callback() {
    //Do Sweep, but for testing, just debit one
    createMarketPlace();
    createUser('hJazzyx@hotmail.com');
    var bankinfo = createTestBankInfo('hJazzyx@hotmail.com');
    debitBankAccount(bankinfo, console.log);
  }
  prereqForDebit({
    marketplace: marketplace,
    campaignId: '123456789abcdefg:offeringsummary:1',
    callback: callback
  });
}

//testSaveBankAccount();
//testVerifyBankAccount();
//testConfirmBankAccount();
//testCreditBankAccount();
//testDebitBankAccount();
//var helper = new BalancedUnitTestsHelper();
//helper.createTesters();
//helper.pickRandomInvestors();

function testCreateBankAccountsForTesters() {
    createMarketPlace();
    db.lrange('localhost:users:testers', 0, -1, function(err, emails) {
      _.each(emails, function(email) {
        db.hgetall('localhost:' + email, function(err, user) {
          var bankinfo = {
            company: 'localhost',
            email: user.email,
            name: user.firstName + ' ' + user.lastName,
            account_number: "026012881",
            routing_number: "121000359",
            type: "checking"
          };
          saveBankAccount(bankinfo, console.log);
        });
      });
    });
  }
  
var testScenario = {
  counts: {
    marketplaces: 2,
    merchants: 3,
    campaigns: 2,
    users: 100
  }
}

function testSweepPart1() {
  /*!
	Create marketplaces: testScenario.counts.marketplaces
	*/
  async.each(_.map(_.range(testScenario.counts.marketplaces), function(a) {
    return 'healthcarex' + String.fromCharCode(97 + a) + '.com';
  }), function(marketplace, callback) {
    var unit = {
      marketplace: marketplace
    };
    var helper = new BalancedUnitTestsHelper(unit);
    helper.createMarketPlace(callback);
    //console.log(unit);
  }, function(err) {
    console.log('Done');
  });
  /*!
	Create Merchants per marketplace: testScenario.counts.merchants		
	*/
  async.waterfall([

    function(callback) {
      db.smembers('crowdfundhost:marketplaces', callback);
    },
    function(marketplaces, callback) {
      var merchants = _.reduce(marketplaces, function(memo, marketplace, i) {
        _.each(_.range(testScenario.counts.merchants), function(b) {
          var merchantUUId = getStaticUUID(i, 2 + b + i);
          memo.push({
            marketplace: marketplace,
            merchant: merchantUUId
          });
          //Needed for CRON
          BalancedUnitTestsHelper.prototype.createTestMerchant({
            uuid: merchantUUId,
            marketplace: marketplace
          });
        });
        return memo;
      }, []);
      console.log(merchants.length);
      callback(null, merchants);
    },
    function(merchants, callback) {
      var counter = 0;
      merchants.forEach(function(rec) {
        /*!
				Create Campaigns per merchants: testScenario.counts.campaigns		
			*/
        async.each(_.range(testScenario.counts.campaigns), function(c, cb) {
          var unit = {
            marketplace: rec.marketplace,
            merchant: rec.merchant,
            campaignId: rec.merchant + ':offeringsummary:' + (c + 1),
            campaignName: 'Your Dream Palace, Child Safety, and Privacy'
          };
          var helper = new BalancedUnitTestsHelper(unit);
          helper.createTestCampaign(cb);
        }, function(err) {
          counter++;
          if (counter == testScenario.counts.campaigns) callback(null, 'done');
        });
      });
    }
  ], function(err, finalresult) {
    console.log(finalresult);
  });
  /*!
	Create users for each marketplace: testScenario.counts.users
	*/
    async.each(_.map(_.range(testScenario.counts.marketplaces), function(a) {
      return 'healthcarex' + String.fromCharCode(97 + a) + '.com';
    }), function(marketplace, callback) {
      var unit = {
        marketplace: marketplace
      };
      //console.log(helper);
      var helper = new BalancedUnitTestsHelper(unit);
      helper.createTesters(testScenario.counts.users, callback);
      //console.log(unit);
    }, function(err) {
      console.log('Done');
    });
  }
  /*!
  	Create 100 investors for each campaign (there are 400 campaigns, so total 40,000);
  */

function testSweepPart2() {
  var units = [];
  //5 marketplaces
  _.each(_.range(testScenario.counts.marketplaces), function(a) {
    var alpha = String.fromCharCode(97 + a);
    //8 merchants per marketplace
    _.each(_.range(testScenario.counts.merchants), function(b) {
      var merchant = getStaticUUID(a, 2 + b + a);
      //10 campaigns per merchant
      _.each(_.range(testScenario.counts.campaigns), function(c) {
        var unit = {
          marketplace: 'healthcarex' + alpha + '.com',
          merchant: merchant,
          campaignId: merchant + ':offeringsummary:' + (c + 1),
          campaignName: 'SMEXI: Smart and Sexy'
        };
        units.push(unit);
      });
    });
  });
  /*!
	 Create 100 investors for each campaign (there are 400 campaigns, so total 40,000);
	*/
  async.each(units, function(unit, callback) {
    var helper = new BalancedUnitTestsHelper(unit);
    helper.pickRandomInvestors(testScenario.counts.users, callback);
  }, function(err) {
    console.log('Done');
  });
}

/*!
	Create customer and associate customer with bank accounts at Balanced
*/
function testSweepPart3() {
  async.waterfall([

    function(next) {
      var marketplaces = _.map(_.range(testScenario.counts.marketplaces), function(a) {
        return 'healthcarex' + String.fromCharCode(97 + a) + '.com';
      });
      var groups = {};
      _.each(marketplaces, function(marketplace) {
        db.zrange(marketplace + ':invest:debits:users', 0, -1, function(err, arr) {
          groups[marketplace] = arr;
          if (_.keys(groups)
            .length == marketplaces.length) next(null, groups)
        });
      });
    },
    function(groups, next) {
      var bankInfos = [],
        counter = 0,
        total = _.reduceRight(_.values(groups), function(a, b) {
          return a.concat(b);
        }, [])
        .length;
      _.each(groups, function(arr, marketplace) {
        async.map(arr, function(email, cb) {
          db.hgetall(marketplace + ':' + email, function(err, user) {
            if (user) {
              cb(null, {
                marketplace: marketplace,
                email: email,
                name: user.firstName + ' ' + user.lastName,
                account_number: 026012881 + (counter++),
                routing_number: "121000359",
                type: "checking"
              });
            } else {
              cb({
                error: 'Error occured'
              });
            }
          });
        }, function(err, bankInfos) {
          next(null, bankInfos);
        });
        
      });
    },
    function(bankInfos, next) {
      //Create or update bank accounts
      async.each(bankInfos, function(bankInfo, cb) {
        db.hgetall(bankInfo.marketplace, function(err, marketplacedata) {
          var config = _.pick(marketplacedata, 'domain', 'marketplace_uri', 'marketplace_secret')
          console.log(config);
          var bc = new BalancedAchCrowdfund(config);
          //Pass this callback
          bankInfo.callback = cb;
          bc.saveBankAccount(bankInfo);
          //cb(null);
        });
      }, function(err) {
        next(null, 'done');
      });
    }
  ], function(err, finalresult) {
    console.log('All done');
  });
}
/*!
	Mass confirm bankaccount
*/

function testSweepPart4() {
  async.waterfall([

    function(next) {
      var marketplaces = _.map(_.range(testScenario.counts.marketplaces), function(a) {
        return 'healthcarex' + String.fromCharCode(97 + a) + '.com';
      });
      var groups = {};
      _.each(marketplaces, function(marketplace) {
        db.zrange(marketplace + ':invest:debits:users', 0, -1, function(err, arr) {
          groups[marketplace] = arr;
          if (_.keys(groups)
            .length == marketplaces.length) next(null, groups)
        });
      });
    },
    function(groups, next) {
      var bankInfos = [],
        counter = 0;
        
      _.each(groups, function(arr, marketplace) {
        async.map(arr, function(email, cb) {
          db.hgetall(marketplace + ':' + email, function(err, user) {
            if (user) {
              cb(null, {
                marketplace: marketplace,
                email: email,
                name: user.firstName + ' ' + user.lastName,
                amount1: 1,
                amount2: 1
              });
            } else {
              cb({
                error: 'Error occured'
              });
            }
          });
        }, function(err, bankInfos) {
          next(null, bankInfos);
        });
        
      });
    },
    function(bankInfos, next) {
      //Create or update bank accounts
      async.each(bankInfos, function(bankInfo, cb) {
        db.hgetall(bankInfo.marketplace, function(err, marketplacedata) {
          var config = _.pick(marketplacedata, 'domain', 'marketplace_uri', 'marketplace_secret')
          console.log(config);
          var bc = new BalancedAchCrowdfund(config);
          //Pass this callback
          bankInfo.callback = cb;
          bc.confirmBankAccount(bankInfo);
          //cb(null);
        });
      }, function(err) {
        next(null, 'done');
      });
    }
  ], function(err, finalresult) {
    console.log('All done');
  });
}
/*!
	Create bank accounts for merchants
*/

function testSweepPart5() {
  /*!
	 Create customer and associate customer with bank accounts at Balanced
	*/
  async.waterfall([

    function(next) {
      var marketplaces = _.map(_.range(testScenario.counts.marketplaces), function(a) {
        return 'healthcarex' + String.fromCharCode(97 + a) + '.com';
      });
      var groups = {};
      _.each(marketplaces, function(marketplace) {
        db.zrange(marketplace + ':merchants', 0, -1, function(err, arr) {
          groups[marketplace] = arr;
          if (_.keys(groups)
            .length == marketplaces.length) next(null, groups)
        });
      });
    },
    function(groups, next) {
      
      var flattened = _.reduce(groups, function(memo, merchants, marketplace) {
        var items = _.map(merchants, function(_uuid) {
          return {
            marketplace: marketplace,
            uuid: _uuid
          };
        });
        memo.push.apply(memo, items);
        return memo;
      }, []);
      next(null, flattened);
    },
    function(flattened, next) {
      async.map(flattened, function(item, cb) {
        //Get merchant detail
        db.get(item.uuid + ':email', function(err, email) {
          if (err) {
            return cb(err);
          }
          cb(null, item.marketplace + ':' + email);
        });
      }, function(err, userids) {
        next(null, userids);
      });
    },
    function(userids, next) {
      async.map(userids, function(userid, cb) {
        console.log(userid);
        db.hgetall(userid, function(err, user) {
          if (user) {
            cb(null, {
              marketplace: userid.split(':')[0],
              email: user.email,
              name: user.firstName + ' ' + user.lastName,
              account_number: 026012881 + (Math.ceil(Math.random() * 10)),
              routing_number: "121000359",
              type: "checking"
            });
          } else {
            cb({
              error: 'Error occured'
            });
          }
        });
      }, function(err, bankInfos) {
        next(null, bankInfos);
      });
    },
    function(bankInfos, next) {
      //Create or update bank accounts
      async.each(bankInfos, function(bankInfo, cb) {
        if (!bankInfo) cb({
          error: 'Error occured'
        });
        db.hgetall(bankInfo.marketplace, function(err, marketplacedata) {
          var config = _.pick(marketplacedata, 'domain', 'marketplace_uri', 'marketplace_secret')
          console.log(config);
          var bc = new BalancedAchCrowdfund(config);
          //Pass this callback
          bankInfo.callback = cb;
          bc.saveBankAccount(bankInfo);
          //bc.dumbo({callback: cb});
          //cb(null);
        });
      }, function(err) {
        next(null, 'done');
      });
    }
  ], function(err, finalresult) {
    console.log('All done');
  });
}
  
//testSweepPart1();
//testSweepPart2();
//testSweepPart3();
//testSweepPart4();
//testSweepPart5();

/*
confirmBankAccount({
	marketplace: 'healthcarexa.com',
	email: 'tester-7999@gmail.com',
	amount1: 1,
	amount2: 1
}, console.log);

db.zrange('healthcarexa.com:campaigns:archive', 0, -1, function(err, arr) {
  _.each(arr, function(c) {
    db.sadd('balanced:campaigns:debited', 'healthcarexa.com:' + c);
  });
});

*/