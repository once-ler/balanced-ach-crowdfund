//Test marketplace changes daily
//https://www.balancedpayments.com/marketplaces/start
/*Notes on terminology
===================================================================================
The escrow balance amount is the sum of all debits minus the sum of all credits. This balance can never go below zero.

The marketplace balance is the sum of all credits to your owner account minus the sum of fees Balanced charges for each transaction. This can go below zero as Balanced charges fees to this account at the time of the transaction. Balanced settles these fees e.g. deducts monies from owner bank account every 7 days.

Note All fees are drawn from your marketplace owner account, not the escrow balance.
*/
/** A typical debit

curl https://api.balancedpayments.com/v1/customers/AC1ikfztVZfUc2s13U4RgQEv/debits \
     -u d500685a0ec411e3a818026ba7d31e6f: \ 
     -d "appears_on_statement_as=Statement text" \
     -d "amount=5000" \
     -d "description=Some descriptive text for the debit in the dashboard"

**/
var domain = 'localhost';
var marketplace = "";
var secret = "";

var redis = require('redis'),
  request = require('request'),
  uuid = require('node-uuid'),
  _ = require('underscore'),
  db = redis.createClient(6379, '127.0.0.1', { no_ready_check: true }),
  supertest = require('supertest'),
  balanced_api = supertest('https://api.balancedpayments.com');

var BalancedAchCrowdfund = require('../lib/balanced-ach-crowdfund');
var balanced_lib = require('balanced-official');

var api = new balanced_lib({
  marketplace_uri: marketplace,
  secret: secret
});

function getCustomer(bankInfo, createCustomer, addBankAccount, callback) {

  console.log(arguments);

  db.hexists('localhost:balanced:customers' + bankInfo.email, function(err, exist) {

    if (err || !exist) {

      console.log('Creating new account');
      //Create one
      return createCustomer(bankInfo, addBankAccount, callback);
    }

    console.log('Account exist');

    addBankAccount(uri, bankInfo, callback);

  });
}

function createCustomer(bankInfo, addBankAccount, callback) {

  api.Customers.create({
    name: bankInfo.name || bankInfo.email,
    email: bankInfo.email,
    meta: {
      accountType: bankInfo.company ? 'merchant' : 'investor'
    }
  }, function(err, newCustomer) {

    if (err) {
      console.error("api.Customer.create", err);
      throw err;
    }

    //Add to our database
    db.hset(domain + ':balanced:customers', bankInfo.company || bankInfo.email, newCustomer.uri);
    db.hmset('balanced:customer:' + (bankInfo.company || bankInfo.email), newCustomer);

    console.log('Account created successfully');
    addBankAccount(newCustomer.uri, bankInfo, callback);
  });

}

function addBankAccount(customerUri, bankInfo, callback) {

  //Create the bank account
  api.BankAccounts.create(bankInfo, function(err, bank) {

    if (err || !bank)
      return callback({
        error: 'failed'
      });

    db.hset(domain + ':balanced:bankaccounts', bankInfo.company || bankInfo.email, bank.uri);

    //Associate it with the account
    api.Customers.addBankAccount(customerUri, bank.uri, function(err, added_bank) {

      if (err || !added_bank)
        return callback({
          error: 'failed'
        })

      //Immediately verify?
      api.BankAccounts.verify(bank.verifications_uri, function(err, result) {
        console.log(err || result);

        //Now there's a verification_uri created, add record to database
        //Add to database
        api.BankAccounts.get(bank.uri, function(err, updatedbank) {
          db.hmset('balanced:bankaccount:' + bankInfo.email, updatedbank);
        });

      });

      callback(bank.uri);

    });
  });
}

function getBankAccount(email, callback) {

  db.get('balanced:' + email, function(err, bank) {

    if (err || !arr)
      return callback({
        error: 'Failed to retrieve bank'
      });

    callback(null, JSON.parse(bank));

  });

}

function destroyCustomer(email) {

  db.hget(domain + ':balanced:customers', email, function(err, customer_uri) {

    api.Customers.destroy(customer_uri, function(err, result) {
      console.log([err, result]);
    });

    db.hdel(domain + ':balanced:customers', email);

    db.del('balanced:customer:' + email);
  });
}

function destroyBankAccount(email) {

  db.hget(domain + ':balanced:bankaccounts', email, function(err, bank_uri) {

    api.BankAccounts.unstore(bank_uri, function(err, result) {
      console.log([err, result]);
    });
    db.hdel(domain + ':balanced:bankaccounts', email);

    db.del('balanced:bankaccount:' + email);
  });

}

function ConfirmBankAccount(email) {

  var self = this;
  db.hgetall('balanced:bankaccount:' + this.email, function(err, bankaccount) {
    //verifications url
    api.BankAccounts.confirm(bankaccount.verification_uri, 1, 1, function(err, result) {
      if (err || !result) {
        console.log(result);
      }
      console.log(result);

    });
  });

}

function DebitBankAccount(options) {

  /*
	on_behalf_of: null,
	appears_on_statement_as: 'example.com',
	*/
  //curl https://api.balancedpayments.com/v1/customers/AC1cqBl09fXklxLgncXrwVBC/debits -d "source_uri=/v1/bank_accounts/BA1dGg4kOE1iy7Kwg3y7MNKn" -d "amount=1000" -d "description=fancy sandwich" -u d500685a0ec411e3a818026ba7d31e6f: -X POST
  var self = this,
    multi = db.multi();
  multi.hget(domain + ':balanced:customers', options.userId);
  multi.hget(domain + ':balanced:bankaccounts', options.userId);
  multi.get(options.company + ':users:' + options.userId);

  multi.exec(function(err, arr) {

    if (!arr || arr.length < 2) {
      return;
    }

    var customer_uri = arr[0],
      bank_uri = arr[1],
      source_uri = '/v1/bank_accounts/' + bank_uri.split('/').pop(),
      url = 'https://api.balancedpayments.com' + customer_uri + '/debits',
      data = {
        source_uri: source_uri,
        amount: options.amount,
        description: options.campaignName,
        on_behalf_of: options.company,
        appears_on_statement_as: options.company.slice(0, 23),
        meta: options
      },
      headers = {
        "content-type": "application/json",
        "content-length": JSON.stringify(data).length,
        "accept": "*/*"
      };

    var reqObj = {
      auth: {
        user: secret + ':'
      },
      url: url,
      headers: headers
    };
    request.post(reqObj, function(error, response, json) {

        var now = Date.now(),
          midnite = new Date().setHours(0, 0, 0, 0);

        if (!error && (response.statusCode.toString().search(/^200|201$/) != -1)) {

          var rec = now + '|' + json.uri + '|' + json.transaction_number + '|' + options.campaignId + '|' + options.campaignName + '|' + options.userId + '|' + options.userName + '|' + options.amount;
          //Company
          db.incrby(options.company + ':balanced:debits:total', options.amount);
          db.lpush(options.company + ':balanced:debits:log', rec);
          db.hincrby(options.company + ':balanced:debits:users', options.userId, options.amount);
          db.hincrby(options.company + ':balanced:debits:campaigns', options.campaignId, options.amount);
          db.hincrby(options.company + ':balanced:debits:day', midnite, options.amount); //line chart?
          db.lpush(options.company + ':balanced:debits:urls', json.uri);

          //Campaign
          db.incrby(options.company + ':balanced:debits:total:' + options.campaignId, options.amount);
          db.lpush(options.company + ':balanced:debits:log:' + options.campaignId, rec);
          db.hincrby(options.company + ':balanced:debits:users:' + options.campaignId, options.userId, options.amount);
          db.hincrby(options.company + ':balanced:debits:day:' + options.campaignId, midnite, options.amount);
          db.lpush(options.company + ':balanced:debits:urls:' + options.campaignId, json.uri);

          //User
          db.incrby(options.company + ':balanced:debits:total:' + options.userId, options.amount);
          db.lpush(options.company + ':balanced:debits:log:' + options.userId, rec);
          db.hincrby(options.company + ':balanced:debits:campaigns:' + options.userId, options.campaignId, options.amount);
          db.hincrby(options.company + ':balanced:debits:day:' + options.userId, midnite, options.amount);
          db.lpush(options.company + ':balanced:debits:urls:' + options.userId, json.uri);

          //Finally save the actual record
          db.set(json.uri, JSON.stringify(json));

        } else {
          //Status Code 411 Length required
          var rec = now + '|' + json.request_id + '|' + json.status_code + ': ' + json.status + '|' + options.campaignId + '|' + options.campaignName + '|' + options.userId + '|' + options.userName + '|' + options.amount;
          //Company
          db.lpush(options.company + ':balanced:debits:log', rec);
          //Campaign
          db.lpush(options.company + ':balanced:debits:log:' + options.campaignId, rec);
          //User
          db.lpush(options.company + ':balanced:debits:log:' + options.userId, rec);

        }
      })
      .json(data);

  });
}

function creditBankAccount(options) {

  /*!
	[ null,
  409,
  '{\n  "status": "Conflict",\n  "category_code": "insufficient-funds",\n  "additional": null,\n  "status_code": 409,\n  "extras": {},\n  "category_type": "logical",\n  "_uris": {},\n  "request_id": "OHMa59ff50813c911e38643026ba7c1aba6",\n  "description": "Marketplace TEST-MP6h3Mnedq36ulGReVomHF7O has insufficient funds to cover a transfer of 1000 to destination BA184L9JRYamIXdRwG3uaIIw. Your request id is OHMa59ff50813c911e38643026ba7c1aba6."\n}' ]
	*/

  var multi = db.multi();
  multi.hget('localhost:balanced:customers', options.company);
  multi.hget('localhost:balanced:bankaccounts', options.company);

  multi.exec(function(err, arr) {

    if (!arr || arr.length < 2)
      return;

    var customer_uri = arr[0],
      bank_uri = arr[1],
      source_uri = '/v1/bank_accounts/' + bank_uri.split('/').pop(),
      url = 'https://api.balancedpayments.com' + customer_uri + '/credits',
      data = {
        source_uri: source_uri,
        amount: options.amount,
        description: options.campaignName,
        on_behalf_of: options.company,
        appears_on_statement_as: options.company.slice(0, 23),
        meta: options
      },
      headers = {
        "content-type": "application/json",
        "content-length": JSON.stringify(data).length,
        "accept": "*/*"
      };

    var reqObj = {
      auth: {
        user: secret + ':'
      },
      url: url,
      headers: headers
    };
    request.post(reqObj, function(error, response, json) {
        if (!error && (response.statusCode.toString().search(/^200|201$/) != -1)) {

          var now = Date.now(),
            midnite = new Date().setHours(0, 0, 0, 0),
            rec = now + '|' + json.uri + '|' + json.transaction_number + '|' + options.campaignId + '|' + options.campaignName + '|' + options.amount;
          //Company
          db.incrby(options.company + ':balanced:credits:total', options.amount);
          db.lpush(options.company + ':balanced:credits:log', rec);
          db.hincrby(options.company + ':balanced:credits:campaigns', options.campaignId, options.amount);
          db.hincrby(options.company + ':balanced:credits:day', midnite, options.amount); //line chart?				

          //Finally save the actual record
          db.set(json.uri, JSON.stringify(json));
        } else {
          //insufficient funds is response.statusCode: 409
          console.log([error, response.statusCode, body]);
        }
      })
      .json(data);

  });

}

function createBankAccount(bankInfo, callback) {
  getCustomer(bankInfo, createCustomer, addBankAccount, callback);
}

function getAllCustomers() {
  api.Customers.list({
    limit: 1,
    offset: 0
  }, function(err, result) {
    console.log(result);
  });
}

function getAllDebits() {
  api.Debits.list({
    limit: 10,
    offset: 0
  }, function(err, result) {
    console.log(result);
  });
}

function getAllCredits() {
  api.Credits.list({
    limit: 10,
    offset: 0
  }, function(err, result) {
    console.log(result);
  });
}

function getCustomerDebits(email) {

  /*
	curl https://api.balancedpayments.com/v1/customers/AC1ikfztVZfUc2s13U4RgQEv?limit=2 \
      -u d500685a0ec411e3a818026ba7d31e6f:
	*/
  db.hget('localhost:balanced:customers', email, function(err, customer_uri) {

    api.Customers.get(customer_uri, function(err, result) {
      var user = api.Customers.nbalanced(result);
      user.Debits.list({
        limit: 10,
        offset: 0
      }, function(err, result) {
        console.log(result);
      });

    });

  });
}

function getDebit(debitId) {

  api.Debits.get("/v1/marketplaces/TEST-MP6ufYrpY7D5mHbOIGkVOkm2/debits/" + debitId, function(err, result) {
    /* . . . */
  });

}

function getMarketPlace() {

  api.Marketplaces.get(function(err, result) {

    if (err) {
      return console.log(err);
    }

    console.log(result); //in_escrow
  });
}

function createTestMarket() {

  require('balanced-official').MakeTestMarket(function(err, config) {

    /*! Expect response:
		{ secret: 'ba3eb9....08026ba7c1aba6',
		marketplace_uri: '/v1/marketplaces/TEST-MP5Gvbo....wXryTI9Q' }
	*/
    return config;
  });
}

/*!
Test
Note: bankAccount is a model
*/
var bankAccount = {
  email: 'jazzy123@gmail.com',
  name: "Nightcrawler Jazzy",
  account_number: "9900826301",
  routing_number: "121000359",
  type: "checking"
};

var bankAccount1 = {
  email: 'hJazzyx@hotmail.com',
  name: "Cyclops Jazzy",
  account_number: "9900826301",
  routing_number: "121000359",
  type: "checking"
};

/*! Company
 */
var bankAccount2 = {
  email: 'admin@localhost.com',
  company: 'localhost',
  name: "Merchant A",
  account_number: "9900826301",
  routing_number: "121000359",
  type: "checking"
};

//This will be our exports
//createBankAccount(bankAccount, console.log);

//Test destroy
//destroyCustomer('jazzy123@gmail.com');
//destroyBankAccount('jazzy123@gmail.com');

//Must confirm bank account before debiting!!
//confirmBankAccount('jazzy123@gmail.com');

//Test debit bank account
//debitBankAccount({company:'localhost', campaignId: 'localhost:campaigns:0', campaignName:'Chuggington NYC Station', userId: 'jazzy123@gmail.com', userName: 'Mr Henry Jazzy', amount: 1000});

//List all customers
//getAllCustomers();

//List all debits
//getAllDebits();

//List all debits for customer
//getCustomerDebits('jazzy123@gmail.com');

//Get all credits
//getAllCredits();

//Get marketplace
//getMarketPlace();

//Test payout (The user account MUST BE the merchant)
//creditBankAccount({company:'localhost', campaignId: 'localhost:campaigns:0', campaignName:'Chuggington NYC Station', amount: 1000});

//Test Make Test Market
//createTestMarket();

/*! 
***********************************************************************************************
Testing
***********************************************************************************************
*/

//Create 10000 test registered users
/*
del localhost:users:members
del localhost:users:testers
ZCOUNT localhost:users:members -inf +inf

	// -Infinity and +Infinity also work
    var args1 = [ 'myzset', '+inf', '-inf' ];
    client.zrevrangebyscore(args1, function (err, response) {
        if (err) throw err;
        console.log('example1', response);
        // write your code here
    });

*/
var names = ['Jacob', 'Mason', 'Ethan', 'Noah', 'William', 'Liam', 'Jayden', 'Michael', 'Alexander', 'Aiden', 'Daniel', 'Matthew', 'Elijah', 'James', 'Anthony', 'Benjamin', 'Joshua', 'Andrew', 'David', 'Joseph', 'Logan', 'Jackson', 'Christopher', 'Gabriel', 'Samuel', 'Ryan', 'Lucas', 'John', 'Nathan', 'Isaac', 'Dylan', 'Caleb', 'Christian', 'Landon', 'Jonathan', 'Carter', 'Luke', 'Owen', 'Brayden', 'Gavin', 'Wyatt', 'Isaiah', 'Henry', 'Eli', 'Hunter', 'Jack', 'Evan', 'Jordan', 'Nicholas', 'Tyler', 'Aaron', 'Jeremiah', 'Julian', 'Cameron', 'Levi', 'Brandon', 'Angel', 'Austin', 'Connor', 'Adrian', 'Robert', 'Charles', 'Thomas', 'Sebastian', 'Colton', 'Jaxon', 'Kevin', 'Zachary', 'Ayden', 'Dominic', 'Blake', 'Jose', 'Oliver', 'Justin', 'Bentley', 'Jason', 'Chase', 'Ian', 'Josiah', 'Parker', 'Xavier', 'Adam', 'Cooper', 'Nathaniel', 'Grayson', 'Jace', 'Carson', 'Nolan', 'Tristan', 'Luis', 'Brody', 'Juan', 'Hudson', 'Bryson', 'Carlos', 'Easton', 'Damian', 'Alex', 'Kayden', 'Ryder', 'Jesus', 'Cole', 'Micah', 'Vincent', 'Max', 'Jaxson', 'Eric', 'Asher', 'Hayden', 'Diego', 'Miles', 'Steven', 'Ivan', 'Elias', 'Aidan', 'Maxwell', 'Bryce', 'Antonio', 'Giovanni', 'Timothy', 'Bryan', 'Santiago', 'Colin', 'Richard', 'Braxton', 'Kaleb', 'Kyle', 'Kaden', 'Preston', 'Miguel', 'Jonah', 'Lincoln', 'Riley', 'Leo', 'Victor', 'Brady', 'Jeremy', 'Mateo', 'Brian', 'Jaden', 'Ashton', 'Patrick', 'Declan', 'Sean', 'Joel', 'Gael', 'Sawyer', 'Alejandro', 'Marcus', 'Leonardo', 'Jesse', 'Caden', 'Jake', 'Kaiden', 'Wesley', 'Camden', 'Edward', 'Roman', 'Axel', 'Silas', 'Jude', 'Grant', 'Cayden', 'Emmanuel', 'George', 'Maddox', 'Malachi', 'Bradley', 'Alan', 'Weston', 'Gage', 'Devin', 'Greyson', 'Kenneth', 'Mark', 'Oscar', 'Tanner', 'Rylan', 'Nicolas', 'Harrison', 'Derek', 'Peyton', 'Ezra', 'Tucker', 'Emmett', 'Avery', 'Cody', 'Calvin', 'Andres', 'Jorge', 'Abel', 'Paul', 'Abraham', 'Kai', 'Collin', 'Theodore', 'Ezekiel', 'Omar', 'Conner', 'Bennett', 'Trevor', 'Eduardo', 'Peter', 'Maximus', 'Jaiden', 'Seth', 'Kingston', 'Javier', 'Travis', 'Garrett', 'Everett', 'Graham', 'Xander', 'Cristian', 'Damien', 'Ryker', 'Griffin', 'Corbin', 'Myles', 'Luca', 'Zane', 'Francisco', 'Ricardo', 'Alexis', 'Stephen', 'Iker', 'Drake', 'Lukas', 'Charlie', 'Spencer', 'Zion', 'Erick', 'Josue', 'Jeffrey', 'Trenton', 'Chance', 'Paxton', 'Elliot', 'Fernando', 'Keegan', 'Landen', 'Manuel', 'Amir', 'Shane', 'Raymond', 'Zander', 'Andre', 'Israel', 'Mario', 'Cesar', 'Simon', 'King', 'Jaylen', 'Johnathan', 'Troy', 'Dean', 'Clayton', 'Dominick', 'Tyson', 'Jasper', 'Martin', 'Kyler', 'Hector', 'Edgar', 'Marco', 'Cash', 'Edwin', 'Shawn', 'Judah', 'Andy', 'Donovan', 'Kameron', 'Elliott', 'Dante', 'Anderson', 'Johnny', 'Drew', 'Sergio', 'Cruz', 'Dalton', 'Rafael', 'Gregory', 'Lane', 'Erik', 'Skyler', 'Finn', 'Reid', 'Jared', 'Caiden', 'Holden', 'Emilio', 'Fabian', 'Aden', 'Brendan', 'Rowan', 'Emiliano', 'Braden', 'Emanuel', 'Lorenzo', 'Roberto', 'Angelo', 'Beau', 'Louis', 'Derrick', 'Dawson', 'Felix', 'Pedro', 'Brennan', 'Frank', 'Maximiliano', 'Quinn', 'Dallas', 'Romeo', 'Joaquin', 'Waylon', 'Allen', 'Ruben', 'Milo', 'Julius', 'Grady', 'August', 'Dakota', 'Cohen', 'Brock', 'Desmond', 'Malik', 'Colby', 'Nehemiah', 'Leland', 'Jett', 'Marcos', 'Taylor', 'Marshall', 'Ty', 'Phillip', 'Corey', 'Ali', 'Adan', 'Dillon', 'Arthur', 'Maverick', 'Leon', 'Brooks', 'Tristen', 'Titus', 'Keith', 'Dexter', 'Emerson', 'Armando', 'Pablo', 'Knox', 'Enrique', 'Cade', 'Gerardo', 'Reed', 'Jayson', 'Barrett', 'Walter', 'Dustin', 'Ronald', 'Trent', 'Phoenix', 'Ismael', 'Julio', 'Danny', 'Scott', 'Jay', 'Esteban', 'Gideon', 'Tate', 'Abram', 'Trey', 'Keaton', 'Jakob', 'Jaime', 'Devon', 'Donald', 'Albert', 'Raul', 'Darius', 'Colten', 'Damon', 'River', 'Gustavo', 'Philip', 'Atticus', 'Walker', 'Matteo', 'Randy', 'Saul', 'Rocco', 'Davis', 'Enzo', 'Noel', 'Orion', 'Bruce', 'Darren', 'Larry', 'Mathew', 'Russell', 'Dennis', 'Tony', 'Chris', 'Porter', 'Rodrigo', 'Kade', 'Ari', 'Hugo', 'Zachariah', 'Mohamed', 'Quentin', 'Solomon', 'Curtis', 'Issac', 'Khalil', 'Alberto', 'Jerry', 'Alec', 'Gianni', 'Moises', 'Gunnar', 'Lawrence', 'Chandler', 'Ronan', 'Prince', 'Payton', 'Arturo', 'Jimmy', 'Orlando', 'Ricky', 'Mitchell', 'Maximilian', 'Malcolm', 'Muhammad', 'Marvin', 'Jalen', 'Cyrus', 'Mauricio', 'Warren', 'Jonas', 'Kendrick', 'Rhys', 'Dane', 'Pierce', 'Johan', 'Rory', 'Uriel', 'Major', 'Bryant', 'Reece', 'Casey', 'Ibrahim', 'Nikolas', 'Arjun', 'Sullivan', 'Finnegan', 'Alfredo', 'Royce', 'Ahmed', 'Lance', 'Ramon', 'Jamison', 'Brenden', 'Dominik', 'Kristopher', 'Maurice', 'Kobe', 'Zackary', 'Rhett', 'Deandre', 'Isaias', 'Channing', 'Ezequiel', 'Tobias', 'Talon', 'Sam', 'Justice', 'Nash', 'Alvin', 'Ace', 'Nico', 'Quinton', 'Franklin', 'Raiden', 'Joe', 'Lawson', 'Gary', 'Aldo', 'Frederick', 'London', 'Carl', 'Byron', 'Ernesto', 'Moshe', 'Terry', 'Eddie', 'Kane', 'Moses', 'Finley', 'Salvador', 'Reese', 'Kelvin', 'Cullen', 'Wade', 'Clark', 'Mohammed', 'Kieran', 'Dorian', 'Korbin', 'Nelson', 'Roy', 'Asa', 'Matias', 'Nasir', 'Nickolas', 'Roger', 'Alonzo', 'Skylar', 'Malakai', 'Douglas', 'Ahmad', 'Uriah', 'Conor', 'Kristian', 'Carmelo', 'Blaine', 'Braeden', 'Julien', 'Nathanael', 'Lucian', 'Morgan', 'Chad', 'Terrance', 'Benson', 'Noe', 'Rodney', 'Francis', 'Layne', 'Mohammad', 'Tatum', 'Brett', 'Wilson', 'Kian', 'Marc', 'Rohan', 'Dayton', 'Braiden', 'Harper', 'Luciano', 'Nikolai', 'Camron', 'Joey', 'Santino', 'Ellis', 'Layton', 'Xzavier', 'Jefferson', 'Winston', 'Guillermo', 'Demetrius', 'Melvin', 'Soren', 'Neil', 'Jon', 'Raphael', 'Rex', 'Yusuf', 'Shaun', 'Brodie', 'Tommy', 'Harley', 'Quincy', 'Dax', 'Trace', 'Adonis', 'Jeffery', 'Odin', 'Luka', 'Willie', 'Lewis', 'Kendall', 'Cory', 'Jonathon', 'Emery', 'Jermaine', 'Reginald', 'Tomas', 'Zechariah', 'Billy', 'Hamza', 'Micheal', 'Urijah', 'Lee', 'Mathias', 'Toby', 'Will', 'Felipe', 'Triston', 'Eden', 'Terrell', 'Deacon', 'Matthias', 'Jamal', 'Maxim', 'Sterling', 'Hank', 'Gerald', 'Alessandro', 'Jaydon', 'Niko', 'Branson', 'Flynn', 'Kody', 'Marlon', 'Mayson', 'Allan', 'Augustus', 'Jessie', 'Adrien', 'Aydan', 'Leonard', 'Terrence', 'Jerome', 'Kole', 'Aron', 'Aydin', 'Ronnie', 'Zain', 'Vicente', 'Bobby', 'Yosef', 'Harry', 'Kale', 'Rogelio', 'Ray', 'Clay', 'Sage', 'Ulises', 'Chaim', 'Brent', 'Jadon', 'Elisha', 'Stanley', 'Alonso', 'Darian', 'Conrad', 'Dwayne', 'Eugene', 'Rene', 'Kareem', 'Roland', 'Ben', 'Vincenzo', 'Abdullah', 'Kenny', 'Blaze', 'Edison', 'Osvaldo', 'Teagan', 'Deshawn', 'Cedric', 'Marquis', 'Samir', 'Steve', 'Draven', 'Davin', 'Ariel', 'Alden', 'Isiah', 'Lennox', 'Jaylin', 'Cain', 'Wayne', 'Craig', 'Lamar', 'Leonidas', 'Otto', 'Bo', 'Darrell', 'Kolby', 'Marcelo', 'Bruno', 'Fletcher', 'Justus', 'Alfonso', 'Theo', 'Tyrone', 'Harvey', 'Rudy', 'Brendon', 'Tristin', 'Dominique', 'Kaeden', 'Samson', 'Lionel', 'Amos', 'Giancarlo', 'Callum', 'Quintin', 'Valentino', 'Lennon', 'Zavier', 'Arlo', 'Junior', 'Killian', 'Leandro', 'Konnor', 'Hezekiah', 'Jordyn', 'Markus', 'Ramiro', 'Johnathon', 'Lyric', 'Rashad', 'Kamryn', 'Duncan', 'Harold', 'Camilo', 'Seamus', 'Coleman', 'Vance', 'Rylee', 'Elian', 'Jamie', 'Antoine', 'Van', 'Branden', 'Darwin', 'Jamar', 'Mike', 'Randall', 'Hassan', 'Thiago', 'Heath', 'Kingsley', 'Xavi', 'Deangelo', 'Vaughn', 'Zeke', 'Ean', 'Frankie', 'Yael', 'Benton', 'Efrain', 'Marcel', 'Rolando', 'Jaycob', 'Keenan', 'Yousef', 'Jedidiah', 'Remy', 'Todd', 'Reagan', 'Valentin', 'Austyn', 'Anders', 'Alvaro', 'Mustafa', 'Thaddeus', 'Brenton', 'Cale', 'Clinton', 'Derick', 'Gilberto', 'Salvatore', 'Freddy', 'Ernest', 'Blaise', 'Maximo', 'Sidney', 'Dario', 'Rodolfo', 'Camryn', 'Sonny', 'Cassius', 'Truman', 'Brice', 'Brogan', 'Hugh', 'Agustin', 'Eliot', 'Stefan', 'Zaid', 'Bridger', 'Damion', 'Eliseo', 'Johann', 'Leroy', 'Sheldon', 'Darryl', 'Tyrell', 'Alfred', 'Ignacio', 'Santos', 'Cael', 'Mack', 'Darien', 'Ross', 'Zaire', 'Aditya', 'Immanuel', 'Reuben', 'Franco', 'Trystan', 'Simeon', 'Anton', 'Darnell', 'Emory', 'Roderick', 'Deon', 'Devan', 'Graeme', 'Howard', 'Jael', 'Jarrett', 'Apollo', 'Denzel', 'Foster', 'Gilbert', 'Jaylon', 'Augustine', 'Sophia', 'Emma', 'Isabella', 'Olivia', 'Ava', 'Emily', 'Abigail', 'Mia', 'Madison', 'Elizabeth', 'Chloe', 'Ella', 'Avery', 'Addison', 'Aubrey', 'Lily', 'Natalie', 'Sofia', 'Charlotte', 'Zoey', 'Grace', 'Hannah', 'Amelia', 'Harper', 'Lillian', 'Samantha', 'Evelyn', 'Victoria', 'Brooklyn', 'Zoe', 'Layla', 'Hailey', 'Leah', 'Kaylee', 'Anna', 'Aaliyah', 'Gabriella', 'Allison', 'Nevaeh', 'Alexis', 'Audrey', 'Savannah', 'Sarah', 'Alyssa', 'Claire', 'Taylor', 'Riley', 'Camila', 'Arianna', 'Ashley', 'Brianna', 'Sophie', 'Peyton', 'Bella', 'Khloe', 'Genesis', 'Alexa', 'Serenity', 'Kylie', 'Aubree', 'Scarlett', 'Stella', 'Maya', 'Katherine', 'Julia', 'Lucy', 'Madelyn', 'Autumn', 'Makayla', 'Kayla', 'Mackenzie', 'Lauren', 'Gianna', 'Ariana', 'Faith', 'Alexandra', 'Melanie', 'Sydney', 'Bailey', 'Caroline', 'Naomi', 'Morgan', 'Kennedy', 'Ellie', 'Jasmine', 'Eva', 'Skylar', 'Kimberly', 'Violet', 'Molly', 'Aria', 'Jocelyn', 'Trinity', 'London', 'Lydia', 'Madeline', 'Reagan', 'Piper', 'Andrea', 'Annabelle', 'Maria', 'Brooke', 'Payton', 'Paisley', 'Paige', 'Ruby', 'Nora', 'Mariah', 'Rylee', 'Lilly', 'Brielle', 'Jade', 'Destiny', 'Nicole', 'Mila', 'Kendall', 'Liliana', 'Kaitlyn', 'Natalia', 'Sadie', 'Jordyn', 'Vanessa', 'Mary', 'Mya', 'Penelope', 'Isabelle', 'Alice', 'Reese', 'Gabrielle', 'Hadley', 'Katelyn', 'Angelina', 'Rachel', 'Isabel', 'Eleanor', 'Clara', 'Brooklynn', 'Jessica', 'Elena', 'Aliyah', 'Vivian', 'Laila', 'Sara', 'Amy', 'Eliana', 'Lyla', 'Juliana', 'Valeria', 'Adriana', 'Makenzie', 'Elise', 'Mckenzie', 'Quinn', 'Delilah', 'Cora', 'Kylee', 'Rebecca', 'Gracie', 'Izabella', 'Josephine', 'Alaina', 'Michelle', 'Jennifer', 'Eden', 'Valentina', 'Aurora', 'Catherine', 'Stephanie', 'Valerie', 'Jayla', 'Willow', 'Daisy', 'Alana', 'Melody', 'Hazel', 'Summer', 'Melissa', 'Margaret', 'Kinley', 'Ariel', 'Lila', 'Giselle', 'Ryleigh', 'Haley', 'Julianna', 'Ivy', 'Alivia', 'Brynn', 'Keira', 'Daniela', 'Aniyah', 'Angela', 'Kate', 'Hayden', 'Harmony', 'Megan', 'Allie', 'Gabriela', 'Alayna', 'Presley', 'Jenna', 'Alexandria', 'Ashlyn', 'Adrianna', 'Jada', 'Fiona', 'Norah', 'Emery', 'Maci', 'Miranda', 'Ximena', 'Amaya', 'Cecilia', 'Ana', 'Shelby', 'Katie', 'Hope', 'Callie', 'Jordan', 'Luna', 'Leilani', 'Eliza', 'Mckenna', 'Angel', 'Genevieve', 'Makenna', 'Isla', 'Lola', 'Danielle', 'Chelsea', 'Leila', 'Tessa', 'Camille', 'Mikayla', 'Adeline', 'Sienna', 'Esther', 'Jacqueline', 'Emerson', 'Arabella', 'Maggie', 'Athena', 'Lucia', 'Lexi', 'Ayla', 'Diana', 'Alexia', 'Juliet', 'Josie', 'Allyson', 'Addyson', 'Delaney', 'Teagan', 'Marley', 'Amber', 'Rose', 'Erin', 'Leslie', 'Kayleigh', 'Amanda', 'Kathryn', 'Kelsey', 'Emilia', 'Alina', 'Kenzie', 'Alicia', 'Alison', 'Paris', 'Sabrina', 'Ashlynn', 'Sierra', 'Cassidy', 'Laura', 'Alondra', 'Iris', 'Kyla', 'Christina', 'Carly', 'Jillian', 'Madilyn', 'Kyleigh', 'Madeleine', 'Cadence', 'Nina', 'Evangeline', 'Nadia', 'Lyric', 'Giuliana', 'Briana', 'Georgia', 'Haylee', 'Fatima', 'Phoebe', 'Selena', 'Charlie', 'Dakota', 'Annabella', 'Abby', 'Daniella', 'Juliette', 'Bianca', 'Mariana', 'Miriam', 'Parker', 'Veronica', 'Gemma', 'Noelle', 'Cheyenne', 'Marissa', 'Heaven', 'Vivienne', 'Joanna', 'Mallory', 'Aubrie', 'Tatum', 'Carmen', 'Gia', 'Jazmine', 'Heidi', 'Miley', 'Baylee', 'Macy', 'Ainsley', 'Jane', 'Anastasia', 'Adelaide', 'Ruth', 'Camryn', 'Kiara', 'Alessandra', 'Hanna', 'Finley', 'Maddison', 'Lia', 'Bethany', 'Karen', 'Kelly', 'Malia', 'Jazmin', 'Jayda', 'Esmeralda', 'Kira', 'Lena', 'Kamryn', 'Kamila', 'Karina', 'Eloise', 'Kara', 'Elisa', 'Rylie', 'Olive', 'Nayeli', 'Tiffany', 'Macie', 'Skyler', 'Angelica', 'Fernanda', 'Annie', 'Jayden', 'Caitlyn', 'Elle', 'Crystal', 'Julie', 'Imani', 'Kendra', 'Talia', 'Angelique', 'Jazlyn', 'Guadalupe', 'Alejandra', 'Emely', 'Lucille', 'Anya', 'April', 'Elsie', 'Scarlet', 'Helen', 'Breanna', 'Kyra', 'Madisyn', 'Rosalie', 'Brittany', 'Arielle', 'Karla', 'Kailey', 'Arya', 'Sarai', 'Harley', 'Miracle', 'Kali', 'Cynthia', 'Daphne', 'Caitlin', 'Cassandra', 'Holly', 'Janelle', 'Marilyn', 'Katelynn', 'Kaylie', 'Itzel', 'Carolina', 'Bristol', 'Haven', 'Michaela', 'Monica', 'June', 'Camilla', 'Jamie', 'Rebekah', 'Lana', 'Serena', 'Tiana', 'Braelyn', 'Savanna', 'Skye', 'Raelyn', 'Madalyn', 'Sasha', 'Perla', 'Bridget', 'Aniya', 'Rowan', 'Logan', 'Aylin', 'Joselyn', 'Nia', 'Hayley', 'Lilian', 'Kassidy', 'Kaylin', 'Celeste', 'Tatiana', 'Jimena', 'Lilyana', 'Catalina', 'Viviana', 'Sloane', 'Courtney', 'Johanna', 'Melany', 'Francesca', 'Ada', 'Alanna', 'Priscilla', 'Danna', 'Angie', 'Kailyn', 'Lacey', 'Sage', 'Lillie', 'Joy', 'Vera', 'Bailee', 'Amira', 'Aileen', 'Aspen', 'Erica', 'Danica', 'Dylan', 'Kiley', 'Gwendolyn', 'Jasmin', 'Lauryn', 'Justice', 'Annabel', 'Dahlia', 'Gloria', 'Lexie', 'Lindsey', 'Hallie', 'Sylvia', 'Elyse', 'Annika', 'Maeve', 'Marlee', 'Kenya', 'Lorelei', 'Selah', 'Adele', 'Natasha', 'Brenda', 'Erika', 'Alyson', 'Emilee', 'Raven', 'Ariella', 'Liana', 'Sawyer', 'Elsa', 'Farrah', 'Cameron', 'Luciana', 'Zara', 'Eve', 'Kaia', 'Helena', 'Anne', 'Estrella', 'Leighton', 'Whitney', 'Lainey', 'Amara', 'Anabella', 'Samara', 'Zoie', 'Amani', 'Phoenix', 'Dulce', 'Paola', 'Marie', 'Aisha', 'Harlow', 'Virginia', 'Regina', 'Jaylee', 'Anika', 'Ally', 'Kayden', 'Kiera', 'Nathalie', 'Mikaela', 'Charley', 'Claudia', 'Aliya', 'Madyson', 'Cecelia', 'Liberty', 'Evie', 'Rosemary', 'Lizbeth', 'Ryan', 'Teresa', 'Ciara', 'Isis', 'Lea', 'Shayla', 'Rosa', 'Desiree', 'Elisabeth', 'Isabela', 'Mariam', 'Brenna', 'Kaylynn', 'Nova', 'Raquel', 'Dana', 'Laney', 'Siena', 'Amelie', 'Clarissa', 'Halle', 'Maleah', 'Linda', 'Shiloh', 'Jessie', 'Greta', 'Marina', 'Melina', 'Natalee', 'Sariah', 'Mollie', 'Nancy', 'Christine', 'Felicity', 'Zuri', 'Irene', 'Simone', 'Matilda', 'Colette', 'Kristen', 'Kallie', 'Mira', 'Hailee', 'Kathleen', 'Meredith', 'Janessa', 'Noemi', 'Leia', 'Tori', 'Alissa', 'Ivanna', 'Sandra', 'Maryam', 'Kassandra', 'Danika', 'Denise', 'Jemma', 'River', 'Emelia', 'Kristina', 'Beatrice', 'Jaylene', 'Karlee', 'Blake', 'Cara', 'Amina', 'Ansley', 'Kaitlynn', 'Iliana', 'Mckayla', 'Adelina', 'Elaine', 'Mercedes', 'Chaya', 'Lindsay', 'Hattie', 'Lisa', 'Marisol', 'Patricia', 'Bryanna', 'Adrienne', 'Emmy', 'Millie', 'Kourtney', 'Leyla', 'Maia', 'Willa', 'Milan', 'Paula', 'Clare', 'Reyna', 'Martha', 'Emilie', 'Yasmin', 'Amirah', 'Aryana', 'Livia', 'Alena', 'Kiana', 'Celia', 'Kailee', 'Rylan', 'Ellen', 'Leanna', 'Renata', 'Mae', 'Chanel', 'Lesly', 'Cindy', 'Carla', 'Pearl', 'Jaylin', 'Angeline', 'Edith', 'Alia', 'Frances', 'Corinne', 'Cherish', 'Wendy', 'Carolyn', 'Lina', 'Tabitha', 'Winter', 'Bryn', 'Jolie', 'Casey', 'Zion', 'Jayde', 'Jaida', 'Salma', 'Diamond', 'Ryann', 'Abbie', 'Paloma', 'Destinee', 'Kaleigh', 'Asia', 'Demi', 'Deborah', 'Elin', 'Mara', 'Nola', 'Tara', 'Taryn', 'Janae', 'Jewel', 'Sonia', 'Heather', 'Shannon', 'Giada', 'Lilith', 'Sharon', 'Eileen', 'Julianne', 'Regan', 'Krystal', 'Sidney', 'Hadassah', 'Macey', 'Mina', 'Paulina', 'Kaitlin', 'Maritza', 'Susan', 'Raina', 'Hana', 'Temperance', 'Aimee', 'Charlize', 'Kendal', 'Lara', 'Roselyn', 'Alannah', 'Alma', 'Dixie', 'Larissa', 'Patience', 'Sky', 'Zaria', 'Elliot', 'Jenny', 'Luz', 'Ali', 'Alisha', 'Campbell', 'Azaria', 'Blair', 'Micah', 'Moriah', 'Myra', 'Lilia', 'Aliza', 'Giovanna', 'Karissa', 'Emory', 'Estella', 'Juniper', 'Kenna', 'Meghan', 'Elissa', 'Rachael', 'Emmaline', 'Jolene', 'Joyce', 'Britney', 'Carlie', 'Haylie', 'Judith', 'Renee', 'Yesenia', 'Barbara', 'Dallas', 'Jaqueline', 'America', 'Azalea', 'Ingrid', 'Marianna', 'Leona', 'Libby', 'Deanna', 'Mattie', 'Kai', 'Annalee', 'Dorothy', 'Kaylyn', 'Rayna', 'Araceli', 'Cambria', 'Evalyn', 'Haleigh', 'Thalia', 'Charity', 'Tamia', 'Carley', 'Katrina', 'Belen', 'Natalya', 'Celine', 'Milana', 'Monroe', 'Estelle', 'Meadow', 'Cristina', 'Zahra', 'Akira', 'Ann', 'Anabel', 'Azariah', 'Carissa', 'Milena', 'Tia', 'Alisa', 'Bree', 'Cheyanne', 'Laurel', 'Kora', 'Marisa', 'Esme', 'Sloan', 'Cailyn', 'Gisselle', 'Kasey', 'Marlene', 'Riya', 'Izabelle', 'Kirsten', 'Aya', 'Devyn', 'Geraldine', 'Hayleigh', 'Sofie', 'Tess', 'Jessa']

function createTesters(done) {

    //for (var i = 0; i < 10000; i++) {
    async.each(_.range(10000), function(d, next) {

      var counter = 0;

      require('crypto').randomBytes(8, function(ex, buf) {
        var token = buf.toString('hex'),
          email = token + '@gmail.com',
          userid = domain + ':users:' + email,
          firstname = names[Math.floor(Math.random() * names.length)],
          lastname = names[Math.floor(Math.random() * names.length)];

        db.zadd(domain + ':users:members', 0, userid);
        db.lpush(domain + ':users:testers', userid);

        //Add bogus record
        db.set(userid, JSON.stringify({
          "domain": domain,
          "emailConfirmed": false,
          "isAdmin": false,
          "user": {
            "title": "Mr",
            "firstName": firstname,
            "lastName": lastname,
            "email": email,
            "password": "$2a$10$GZBMlSG4awkcgz0Rg5LieuC9YY9sWf/gOox85b3Yd7NJcO.xh7/iG",
            "passwordConfirm": "$2a$10$GZBMlSG4awkcgz0Rg5LieuC9YY9sWf/gOox85b3Yd7NJcO.xh7/iG",
            "joined": Date.now()
          },
          "accreditation": {
            "affirm": "I have an individual net worth, or joint net worth with my spouse that exceeds $1,000,000 today, excluding myprimary residence."
          },
          "experience": {
            "employer": "CTO",
            "industry": "Healthcare",
            "experience": "No Experience",
            "investmentsMade": ["REITS", "Private Equity"]
          },
          "preferences": {
            "properties": ["Retail / Restaurant", "Small Office / Flex Space", "Multi-Family Residential"],
            "cities": ["New York City"],
            "amount": "> $10,000",
            "tolerance": "Moderate Risk / Moderate Yield"
          },
          "_id": userid
        }));

        //Add user names, for email purposes
        var nameobj = {};
        nameobj[email] = (counter % 2 == 0 ? 'Mr ' : 'Ms ') + firstname + ' ' + lastname;
        db.hmset(domain + ":users:names", nameobj, function(err) {
          next();
        });

        counter++;

      });

    //}
    }, function(err){
      //mocha done
      done();
    });

  }
  //Delete Users

function deleteTesters() {
    db.smembers(domain + ':users:testers', function(err, arr) {

      for (var i = 0; i < arr.length; i++) {
        db.lrem(domain + ':users:testers', 0, arr[i]);
        db.zrem(domain + ':users:members', arr[i]);
        db.del(arr[i]);
        db.hdel(domain + ':users:names', arr[i].replace(domain + ':users:', ''));

      }
    });
  }
  //Create a test campaign

function createTestCampaign() {

  require('crypto').randomBytes(8, function(ex, buf) {
    var token = buf.toString('hex')

    var campaignid = domain + ':campaigns:' + token;

    db.zadd(domain + ':campaigns:members', Date.now(), campaignid);
    db.lpush(domain + ':campaigns:testers', campaignid);
    var nameobj = {};
    nameobj[campaignid] = 'The Empire Stirkes Back Spa';
    db.hmset(domain + ":campaigns:names", nameobj);
    db.set(campaignid,

      JSON.stringify({
        "_id": campaignid,
        "namespace": "registered",
        "offeringSummary": {
          "propertyName": "Chuggington NYC Clinical Trials",
          "capitalRequirements": "500000",
          "minimumInvestment": "25000",
          "projectedReturnOnInvestment": "725000",
          "totalShares": "500000",
          "pricePerUnit": "1",
          "city": "New York",
          "state": "NY",
          "estimatedAnnualReturn": "0.25",
          "investmentType": "Equity Purchase",
          "holdPeriod": "3 to 5 year",
          "picture": "",
          "description": "<strong class=\"text-info\">This is another test</strong>",
          "raised": 100000,
          "pledged": 3,
          "daysLeft": 60
        }
      });
    );
  });
}

function deleteTestCampaign() {

  db.smembers(domain + ':campaigns:testers', function(err, arr) {

    for (var i = 0; i < arr.length; i++) {
      db.lrem(domain + ':campaigns:testers', 0, arr[i]);
      db.zrem(domain + ':campaigns:members', arr[i]);
      db.del(arr[i]);
      db.hdel(domain + ':campaigns:names', arr[i]);

    }
  });

}

function pickRandomInvestors() {

  var investors = [];
  /* There are 10K users.  5% will invest  1/20 */
  for (var i = 0; i < 10000; i++) {
    if (i % 20 == 0)
      investors.push(i);
  }

  console.log(investors.length);

  var multi = db.multi();
  for (var i = 0; i < investors.length; i++) {

    multi.lindex(domain + ':users:testers', investors[i]);

  }
  multi.exec(function(err, arr) {
    //save the investors
    for (var m = 0; m < arr.length; m++) {
      db.sadd(domain + ':investors:testers', arr[m]);
      if (m == arr.length - 1)
        console.log('done');
    }
  });
}

function dupeTesters() {

  //Recover testers!!!!!
  db.zrange([domain + ':users:members', 0, -1], function(err, arr) {
    _.each(arr, function(d) {
      db.lpush(domain + ':users:testers', d);
    });
  });
}

function recoverInvestors() {

  //Recover testers!!!!!
  db.keys('balanced:bank*', function(err, arr) {
    _.each(arr, function(d) {
      var email = d.split(':')[2];
      db.sadd(domain + ':investors:testers', domain + ':users:' + email);
    });
  });
}

function deleteInvestors() {
  db.del(domain + ':investors:testers');
}

function createInvestorBankAccounts() {

  function random() {

    var r = _.reduce(_.range(10), function(memo, d) {
      memo += Math.floor(Math.random() * 10);
      return memo;
    }, '');

    return r;
  }

  db.smembers(domain + ':investors:testers', function(err, arr) {

    db.mget(arr, function(err, users) {

      var json = _.map(users, function(d) {
        return JSON.parse(d);
      });

      /*!
				We have the investors info,
				we can now:
					sign them up with a Balanced Account
					enter a bogus Bank Account
					debit their bank account $10K - $50K
			*/

      for (var u in json) {

        var d = json[u].user;

        var bankInfo = {
          email: d.email,
          name: d.title + ' ' + d.firstName + ' ' + d.lastName,
          account_number: random(),
          routing_number: "121000359",
          type: "checking"
        }

        createBankAccount(bankInfo, console.log);

      }

    });
  });
}

function deleteInvestorBankAccounts() {

  db.smembers(domain + ':investors:testers', function(err, arr) {

    db.mget(arr, function(err, users) {

      var json = _.map(users, function(d) {
        return JSON.parse(d);
      });

      for (var u in json) {

        var d = json[u].user;

        destroyBankAccount(d.email);
        destroyCustomer(d.email);

      }

    });
  });

}

function sweepInvestors(options, done) {

  //Initialize
  db.hgetall(options.company + ':invest:debits:users:' + options.campaignId, function(err, pledges) {

    //Convert to db ids
    var uids = _.map(pledges, function(v, k) {
      return options.company + ':users:' + k;
    });

    db.mget(uids, function(err, arr) {

      //_.each(arr, function(e) {
      async.each(arr, function(e, cb) {

        var profile = JSON.parse(e);
        _.extend(options, {
          userId: profile.user.email,
          userName: profile.user.title + ' ' + profile.user.firstName + ' ' + profile.user.lastName,
          amount: pledges[profile.user.email]
        });

        var balancedAchCrowdfund = new BalancedAchCrowdfund({
          company: domain
        });

        //Although the user pledged, did the user actually confirm their bank account with Balanced?
        //If not, can't debit their account
        options.callback = cb;
        balancedAchCrowdfund.confirmBankAccount(options);

      }, function(err){
        //mocha done
        done();
      });

    });

  });

}
function startTestSweep(done) {

  //Get the investment details
  db.lindex(domain + ':campaigns:testers', 0, function(err, cid) {

    db.hget(domain + ':campaigns:names', cid, function(err, cname) {

      var options = {
        company: domain,
        campaignId: cid,
        campaignName: cname
      };

      sweepInvestors(options, done);

    });

  });
}

describe("Start sweep investors", function() {

  before(function(done) {

    async.series([
      createTesters,    
      createTestCampaign,
      pickRandomInvestors, //500 done
      createInvestorBankAccounts,
      createInvestors,
      startTestSweep
    ], function(err) {
      done();
    });
  });

  it('Balanced processed and number of investors in the database should be the same', function(done){

    //db...

  });    

});

/*
function startTestSweep() {

  //Get the investment details
  db.lindex(domain + ':campaigns:testers', 0, function(err, cid) {

    db.hget(domain + ':campaigns:names', cid, function(err, cname) {

      var options = {
        company: domain,
        campaignId: cid,
        campaignName: cname
      };

      sweepInvestors(options);

    });

  });
}
*/
function deleteTestSweep() {

  db.keys(domain + ':invest:debit*', function(err, arr) {
    _.each(arr, function(d) {
      db.del(d);
    });
  });
}

function backInvestment(options) {

  var buffer = new Buffer(16);
  uuid.v4({
    rng: uuid.nodeRNG
  }, buffer, 0);
  var _uuid = uuid.unparse(buffer);

  var now = Date.now(),
    midnite = new Date().setHours(0, 0, 0, 0),
    rec = now + '|' + _uuid + '|' + options.campaignId + '|' + options.campaignName + '|' + options.userId + '|' + options.userName + '|' + options.amount;

  var newrec = {
    datetime: now,
    campaignId: options.campaignId,
    campaignName: options.campaignName,
    userId: options.userId,
    userName: options.userName,
    amount: options.amount
  };

  /*
	Note: {
		company: ...
		userId: ...
	} 
	company is the uuid of the merchant 
	userId is the email
	*/

  //Company
  db.incrby(options.company + ':invest:debits:total', options.amount);
  db.lpush(options.company + ':invest:debits:uuids', _uuid);
  db.hmset(_uuid, newrec);

  db.zincrby(options.company + ':invest:debits:users', options.amount, options.userId);
  db.zincrby(options.company + ':invest:debits:campaigns', options.amount, options.userId);
  db.zincrby(options.company + ':invest:debits:day', options.amount, options.userId);

  //Campaign
  db.incrby(options.company + ':invest:debits:total:' + options.campaignId, options.amount);
  db.lpush(options.company + ':invest:debits:uuids:' + options.campaignId, _uuid);

  db.zincrby(options.company + ':invest:debits:users' + options.campaignId, options.amount, options.userId);
  db.zincrby(options.company + ':invest:debits:day' + options.campaignId, options.amount, options.userId);

  //User
  db.incrby(options.company + ':invest:debits:total:' + options.userId, options.amount);
  db.lpush(options.company + ':invest:debits:uuids:' + options.userId, _uuid);

  db.zincrby(options.company + ':invest:debits:campaigns' + options.userId, options.amount, options.campaignId);
  db.zincrby(options.company + ':invest:debits:day' + options.userId, options.amount, midnite);

}

function createInvestors() {

  function roundAccuracy(num, acc) {

    var factor = Math.pow(10, acc);
    return Math.round(num * factor) / factor;
  }

  function randomFromInterval(from, to) {
    return roundAccuracy(Math.floor(Math.random() * (to - from + 1) + from), -3);
  }

  db.smembers(domain + ':investors:testers', function(err, arr) {

    db.mget(arr, function(err, users) {

      var json = _.map(users, function(d) {
        return JSON.parse(d);
      });

      _.each(json, function(profile) {

        var d = profile.user;

        //Get the investment details
        db.lindex(domain + ':campaigns:testers', 0, function(err, cid) {

          db.hget(domain + ':campaigns:names', cid, function(err, cname) {

            var options = {
              company: domain,
              userId: d.email,
              userName: d.title + ' ' + d.firstName + ' ' + d.lastName,
              campaignId: cid,
              campaignName: cname,
              amount: randomFromInterval(5000, 100000)
            };

            backInvestment(options);

          });

        });

      });

    });
  });
}

//createTesters();
//deleteTesters();

//createTestCampaign();
//deleteTestCampaign();

//pickRandomInvestors(); //500 done

//createInvestorBankAccounts();
//deleteInvestorBankAccounts();

//createInvestors();
//deleteInvestors(); //DANGEROUS!
//recoverInvestors();

//startTestSweep();
//deleteTestSweep(); //simply wipe out what was created by createInvestors()

//confirmBankAccount('ff1f8e3f3411ebb9@gmail.com');

//dupeTesters();

/*

//Delete + Refresh
//================

db.keys('balanced:cust*', function(err, arr) {
	_.each(arr, function(d) {
		db.del(d);
	});
});

db.keys('localhost:inv*', function(err, arr) {
	_.each(arr, function(d) {
		db.del(d);
	});
});

db.keys('localhost:invest:debit*', function(err, arr) {
	_.each(arr, function(d) {
		db.del(d);
	});
});

db.keys('localhost:balanced:verifi*', function(err, arr) {
	_.each(arr, function(d) {
		db.del(d);
	});
});
*/