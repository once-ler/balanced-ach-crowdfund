var redis = require('redis'),
  uuid = require('node-uuid'),
  async = require('async'),
  moment = require('moment'),
  _ = require('underscore'),
  db = redis.createClient(6379, 'localhost', {
    no_ready_check: true
  });
BalancedUnitTestsHelper = function(options) {
  this.options = _.extend({}, options);
};
BalancedUnitTestsHelper.prototype.createMarketPlace = function(cb) {
  db.sadd('crowdfundhost:marketplaces', this.options.marketplace);
  db.hmset(this.options.marketplace, {
    domain: this.options.marketplace,
    marketplace_uri: '',
    marketplace_secret: ''
  }, function(err, resp) {
    if (cb) cb(null);
  });
}
BalancedUnitTestsHelper.prototype.createTestCampaign = function(cb) {
  /*!
		Needed for CRON
	*/
  var yesterday = moment()
    .subtract('days', 1)
    .endOf('day')
    .valueOf();
  db.zadd('balanced:campaigns:expire', yesterday, this.options.marketplace + ':' + this.options.campaignId);
  db.zadd(this.options.marketplace + ':campaigns', Date.now(), this.options.campaignId);
  db.hmset(this.options.campaignId, {
    name: this.options.campaignName,
    capitalRequirements: 100000,
    _id: this.options.campaignId
  }, function(err, resp) {
    if (cb) cb(null);
  });
}
var names = ['Jacob', 'Mason', 'Ethan', 'Noah', 'William', 'Liam', 'Jayden', 'Michael', 'Alexander', 'Aiden', 'Daniel', 'Matthew', 'Elijah', 'James', 'Anthony',
  'Benjamin', 'Joshua', 'Andrew', 'David', 'Joseph', 'Logan', 'Jackson', 'Christopher', 'Gabriel', 'Samuel', 'Ryan', 'Lucas', 'John', 'Nathan', 'Isaac',
  'Dylan', 'Caleb', 'Christian', 'Landon', 'Jonathan', 'Carter', 'Luke', 'Owen', 'Brayden', 'Gavin', 'Wyatt', 'Isaiah', 'Henry', 'Eli', 'Hunter', 'Jack',
  'Evan', 'Jordan', 'Nicholas', 'Tyler', 'Aaron', 'Jeremiah', 'Julian', 'Cameron', 'Levi', 'Brandon', 'Angel', 'Austin', 'Connor', 'Adrian', 'Robert',
  'Charles', 'Thomas', 'Sebastian', 'Colton', 'Jaxon', 'Kevin', 'Zachary', 'Ayden', 'Dominic', 'Blake', 'Jose', 'Oliver', 'Justin', 'Bentley', 'Jason',
  'Chase', 'Ian', 'Josiah', 'Parker', 'Xavier', 'Adam', 'Cooper', 'Nathaniel', 'Grayson', 'Jace', 'Carson', 'Nolan', 'Tristan', 'Luis', 'Brody', 'Juan',
  'Hudson', 'Bryson', 'Carlos', 'Easton', 'Damian', 'Alex', 'Kayden', 'Ryder', 'Jesus', 'Cole', 'Micah', 'Vincent', 'Max', 'Jaxson', 'Eric', 'Asher',
  'Hayden', 'Diego', 'Miles', 'Steven', 'Ivan', 'Elias', 'Aidan', 'Maxwell', 'Bryce', 'Antonio', 'Giovanni', 'Timothy', 'Bryan', 'Santiago', 'Colin',
  'Richard', 'Braxton', 'Kaleb', 'Kyle', 'Kaden', 'Preston', 'Miguel', 'Jonah', 'Lincoln', 'Riley', 'Leo', 'Victor', 'Brady', 'Jeremy', 'Mateo', 'Brian',
  'Jaden', 'Ashton', 'Patrick', 'Declan', 'Sean', 'Joel', 'Gael', 'Sawyer', 'Alejandro', 'Marcus', 'Leonardo', 'Jesse', 'Caden', 'Jake', 'Kaiden', 'Wesley',
  'Camden', 'Edward', 'Roman', 'Axel', 'Silas', 'Jude', 'Grant', 'Cayden', 'Emmanuel', 'George', 'Maddox', 'Malachi', 'Bradley', 'Alan', 'Weston', 'Gage',
  'Devin', 'Greyson', 'Kenneth', 'Mark', 'Oscar', 'Tanner', 'Rylan', 'Nicolas', 'Harrison', 'Derek', 'Peyton', 'Ezra', 'Tucker', 'Emmett', 'Avery', 'Cody',
  'Calvin', 'Andres', 'Jorge', 'Abel', 'Paul', 'Abraham', 'Kai', 'Collin', 'Theodore', 'Ezekiel', 'Omar', 'Conner', 'Bennett', 'Trevor', 'Eduardo', 'Peter',
  'Maximus', 'Jaiden', 'Seth', 'Kingston', 'Javier', 'Travis', 'Garrett', 'Everett', 'Graham', 'Xander', 'Cristian', 'Damien', 'Ryker', 'Griffin', 'Corbin',
  'Myles', 'Luca', 'Zane', 'Francisco', 'Ricardo', 'Alexis', 'Stephen', 'Iker', 'Drake', 'Lukas', 'Charlie', 'Spencer', 'Zion', 'Erick', 'Josue', 'Jeffrey',
  'Trenton', 'Chance', 'Paxton', 'Elliot', 'Fernando', 'Keegan', 'Landen', 'Manuel', 'Amir', 'Shane', 'Raymond', 'Zander', 'Andre', 'Israel', 'Mario',
  'Cesar', 'Simon', 'King', 'Jaylen', 'Johnathan', 'Troy', 'Dean', 'Clayton', 'Dominick', 'Tyson', 'Jasper', 'Martin', 'Kyler', 'Hector', 'Edgar', 'Marco',
  'Cash', 'Edwin', 'Shawn', 'Judah', 'Andy', 'Donovan', 'Kameron', 'Elliott', 'Dante', 'Anderson', 'Johnny', 'Drew', 'Sergio', 'Cruz', 'Dalton', 'Rafael',
  'Gregory', 'Lane', 'Erik', 'Skyler', 'Finn', 'Reid', 'Jared', 'Caiden', 'Holden', 'Emilio', 'Fabian', 'Aden', 'Brendan', 'Rowan', 'Emiliano', 'Braden',
  'Emanuel', 'Lorenzo', 'Roberto', 'Angelo', 'Beau', 'Louis', 'Derrick', 'Dawson', 'Felix', 'Pedro', 'Brennan', 'Frank', 'Maximiliano', 'Quinn', 'Dallas',
  'Romeo', 'Joaquin', 'Waylon', 'Allen', 'Ruben', 'Milo', 'Julius', 'Grady', 'August', 'Dakota', 'Cohen', 'Brock', 'Desmond', 'Malik', 'Colby', 'Nehemiah',
  'Leland', 'Jett', 'Marcos', 'Taylor', 'Marshall', 'Ty', 'Phillip', 'Corey', 'Ali', 'Adan', 'Dillon', 'Arthur', 'Maverick', 'Leon', 'Brooks', 'Tristen',
  'Titus', 'Keith', 'Dexter', 'Emerson', 'Armando', 'Pablo', 'Knox', 'Enrique', 'Cade', 'Gerardo', 'Reed', 'Jayson', 'Barrett', 'Walter', 'Dustin', 'Ronald',
  'Trent', 'Phoenix', 'Ismael', 'Julio', 'Danny', 'Scott', 'Jay', 'Esteban', 'Gideon', 'Tate', 'Abram', 'Trey', 'Keaton', 'Jakob', 'Jaime', 'Devon', 'Donald',
  'Albert', 'Raul', 'Darius', 'Colten', 'Damon', 'River', 'Gustavo', 'Philip', 'Atticus', 'Walker', 'Matteo', 'Randy', 'Saul', 'Rocco', 'Davis', 'Enzo',
  'Noel', 'Orion', 'Bruce', 'Darren', 'Larry', 'Mathew', 'Russell', 'Dennis', 'Tony', 'Chris', 'Porter', 'Rodrigo', 'Kade', 'Ari', 'Hugo', 'Zachariah',
  'Mohamed', 'Quentin', 'Solomon', 'Curtis', 'Issac', 'Khalil', 'Alberto', 'Jerry', 'Alec', 'Gianni', 'Moises', 'Gunnar', 'Lawrence', 'Chandler', 'Ronan',
  'Prince', 'Payton', 'Arturo', 'Jimmy', 'Orlando', 'Ricky', 'Mitchell', 'Maximilian', 'Malcolm', 'Muhammad', 'Marvin', 'Jalen', 'Cyrus', 'Mauricio',
  'Warren', 'Jonas', 'Kendrick', 'Rhys', 'Dane', 'Pierce', 'Johan', 'Rory', 'Uriel', 'Major', 'Bryant', 'Reece', 'Casey', 'Ibrahim', 'Nikolas', 'Arjun',
  'Sullivan', 'Finnegan', 'Alfredo', 'Royce', 'Ahmed', 'Lance', 'Ramon', 'Jamison', 'Brenden', 'Dominik', 'Kristopher', 'Maurice', 'Kobe', 'Zackary', 'Rhett',
  'Deandre', 'Isaias', 'Channing', 'Ezequiel', 'Tobias', 'Talon', 'Sam', 'Justice', 'Nash', 'Alvin', 'Ace', 'Nico', 'Quinton', 'Franklin', 'Raiden', 'Joe',
  'Lawson', 'Gary', 'Aldo', 'Frederick', 'London', 'Carl', 'Byron', 'Ernesto', 'Moshe', 'Terry', 'Eddie', 'Kane', 'Moses', 'Finley', 'Salvador', 'Reese',
  'Kelvin', 'Cullen', 'Wade', 'Clark', 'Mohammed', 'Kieran', 'Dorian', 'Korbin', 'Nelson', 'Roy', 'Asa', 'Matias', 'Nasir', 'Nickolas', 'Roger', 'Alonzo',
  'Skylar', 'Malakai', 'Douglas', 'Ahmad', 'Uriah', 'Conor', 'Kristian', 'Carmelo', 'Blaine', 'Braeden', 'Julien', 'Nathanael', 'Lucian', 'Morgan', 'Chad',
  'Terrance', 'Benson', 'Noe', 'Rodney', 'Francis', 'Layne', 'Mohammad', 'Tatum', 'Brett', 'Wilson', 'Kian', 'Marc', 'Rohan', 'Dayton', 'Braiden', 'Harper',
  'Luciano', 'Nikolai', 'Camron', 'Joey', 'Santino', 'Ellis', 'Layton', 'Xzavier', 'Jefferson', 'Winston', 'Guillermo', 'Demetrius', 'Melvin', 'Soren',
  'Neil', 'Jon', 'Raphael', 'Rex', 'Yusuf', 'Shaun', 'Brodie', 'Tommy', 'Harley', 'Quincy', 'Dax', 'Trace', 'Adonis', 'Jeffery', 'Odin', 'Luka', 'Willie',
  'Lewis', 'Kendall', 'Cory', 'Jonathon', 'Emery', 'Jermaine', 'Reginald', 'Tomas', 'Zechariah', 'Billy', 'Hamza', 'Micheal', 'Urijah', 'Lee', 'Mathias',
  'Toby', 'Will', 'Felipe', 'Triston', 'Eden', 'Terrell', 'Deacon', 'Matthias', 'Jamal', 'Maxim', 'Sterling', 'Hank', 'Gerald', 'Alessandro', 'Jaydon',
  'Niko', 'Branson', 'Flynn', 'Kody', 'Marlon', 'Mayson', 'Allan', 'Augustus', 'Jessie', 'Adrien', 'Aydan', 'Leonard', 'Terrence', 'Jerome', 'Kole', 'Aron',
  'Aydin', 'Ronnie', 'Zain', 'Vicente', 'Bobby', 'Yosef', 'Harry', 'Kale', 'Rogelio', 'Ray', 'Clay', 'Sage', 'Ulises', 'Chaim', 'Brent', 'Jadon', 'Elisha',
  'Stanley', 'Alonso', 'Darian', 'Conrad', 'Dwayne', 'Eugene', 'Rene', 'Kareem', 'Roland', 'Ben', 'Vincenzo', 'Abdullah', 'Kenny', 'Blaze', 'Edison',
  'Osvaldo', 'Teagan', 'Deshawn', 'Cedric', 'Marquis', 'Samir', 'Steve', 'Draven', 'Davin', 'Ariel', 'Alden', 'Isiah', 'Lennox', 'Jaylin', 'Cain', 'Wayne',
  'Craig', 'Lamar', 'Leonidas', 'Otto', 'Bo', 'Darrell', 'Kolby', 'Marcelo', 'Bruno', 'Fletcher', 'Justus', 'Alfonso', 'Theo', 'Tyrone', 'Harvey', 'Rudy',
  'Brendon', 'Tristin', 'Dominique', 'Kaeden', 'Samson', 'Lionel', 'Amos', 'Giancarlo', 'Callum', 'Quintin', 'Valentino', 'Lennon', 'Zavier', 'Arlo',
  'Junior', 'Killian', 'Leandro', 'Konnor', 'Hezekiah', 'Jordyn', 'Markus', 'Ramiro', 'Johnathon', 'Lyric', 'Rashad', 'Kamryn', 'Duncan', 'Harold', 'Camilo',
  'Seamus', 'Coleman', 'Vance', 'Rylee', 'Elian', 'Jamie', 'Antoine', 'Van', 'Branden', 'Darwin', 'Jamar', 'Mike', 'Randall', 'Hassan', 'Thiago', 'Heath',
  'Kingsley', 'Xavi', 'Deangelo', 'Vaughn', 'Zeke', 'Ean', 'Frankie', 'Yael', 'Benton', 'Efrain', 'Marcel', 'Rolando', 'Jaycob', 'Keenan', 'Yousef',
  'Jedidiah', 'Remy', 'Todd', 'Reagan', 'Valentin', 'Austyn', 'Anders', 'Alvaro', 'Mustafa', 'Thaddeus', 'Brenton', 'Cale', 'Clinton', 'Derick', 'Gilberto',
  'Salvatore', 'Freddy', 'Ernest', 'Blaise', 'Maximo', 'Sidney', 'Dario', 'Rodolfo', 'Camryn', 'Sonny', 'Cassius', 'Truman', 'Brice', 'Brogan', 'Hugh',
  'Agustin', 'Eliot', 'Stefan', 'Zaid', 'Bridger', 'Damion', 'Eliseo', 'Johann', 'Leroy', 'Sheldon', 'Darryl', 'Tyrell', 'Alfred', 'Ignacio', 'Santos',
  'Cael', 'Mack', 'Darien', 'Ross', 'Zaire', 'Aditya', 'Immanuel', 'Reuben', 'Franco', 'Trystan', 'Simeon', 'Anton', 'Darnell', 'Emory', 'Roderick', 'Deon',
  'Devan', 'Graeme', 'Howard', 'Jael', 'Jarrett', 'Apollo', 'Denzel', 'Foster', 'Gilbert', 'Jaylon', 'Augustine', 'Sophia', 'Emma', 'Isabella', 'Olivia',
  'Ava', 'Emily', 'Abigail', 'Mia', 'Madison', 'Elizabeth', 'Chloe', 'Ella', 'Avery', 'Addison', 'Aubrey', 'Lily', 'Natalie', 'Sofia', 'Charlotte', 'Zoey',
  'Grace', 'Hannah', 'Amelia', 'Harper', 'Lillian', 'Samantha', 'Evelyn', 'Victoria', 'Brooklyn', 'Zoe', 'Layla', 'Hailey', 'Leah', 'Kaylee', 'Anna',
  'Aaliyah', 'Gabriella', 'Allison', 'Nevaeh', 'Alexis', 'Audrey', 'Savannah', 'Sarah', 'Alyssa', 'Claire', 'Taylor', 'Riley', 'Camila', 'Arianna', 'Ashley',
  'Brianna', 'Sophie', 'Peyton', 'Bella', 'Khloe', 'Genesis', 'Alexa', 'Serenity', 'Kylie', 'Aubree', 'Scarlett', 'Stella', 'Maya', 'Katherine', 'Julia',
  'Lucy', 'Madelyn', 'Autumn', 'Makayla', 'Kayla', 'Mackenzie', 'Lauren', 'Gianna', 'Ariana', 'Faith', 'Alexandra', 'Melanie', 'Sydney', 'Bailey', 'Caroline',
  'Naomi', 'Morgan', 'Kennedy', 'Ellie', 'Jasmine', 'Eva', 'Skylar', 'Kimberly', 'Violet', 'Molly', 'Aria', 'Jocelyn', 'Trinity', 'London', 'Lydia',
  'Madeline', 'Reagan', 'Piper', 'Andrea', 'Annabelle', 'Maria', 'Brooke', 'Payton', 'Paisley', 'Paige', 'Ruby', 'Nora', 'Mariah', 'Rylee', 'Lilly',
  'Brielle', 'Jade', 'Destiny', 'Nicole', 'Mila', 'Kendall', 'Liliana', 'Kaitlyn', 'Natalia', 'Sadie', 'Jordyn', 'Vanessa', 'Mary', 'Mya', 'Penelope',
  'Isabelle', 'Alice', 'Reese', 'Gabrielle', 'Hadley', 'Katelyn', 'Angelina', 'Rachel', 'Isabel', 'Eleanor', 'Clara', 'Brooklynn', 'Jessica', 'Elena',
  'Aliyah', 'Vivian', 'Laila', 'Sara', 'Amy', 'Eliana', 'Lyla', 'Juliana', 'Valeria', 'Adriana', 'Makenzie', 'Elise', 'Mckenzie', 'Quinn', 'Delilah', 'Cora',
  'Kylee', 'Rebecca', 'Gracie', 'Izabella', 'Josephine', 'Alaina', 'Michelle', 'Jennifer', 'Eden', 'Valentina', 'Aurora', 'Catherine', 'Stephanie', 'Valerie',
  'Jayla', 'Willow', 'Daisy', 'Alana', 'Melody', 'Hazel', 'Summer', 'Melissa', 'Margaret', 'Kinley', 'Ariel', 'Lila', 'Giselle', 'Ryleigh', 'Haley',
  'Julianna', 'Ivy', 'Alivia', 'Brynn', 'Keira', 'Daniela', 'Aniyah', 'Angela', 'Kate', 'Hayden', 'Harmony', 'Megan', 'Allie', 'Gabriela', 'Alayna',
  'Presley', 'Jenna', 'Alexandria', 'Ashlyn', 'Adrianna', 'Jada', 'Fiona', 'Norah', 'Emery', 'Maci', 'Miranda', 'Ximena', 'Amaya', 'Cecilia', 'Ana', 'Shelby',
  'Katie', 'Hope', 'Callie', 'Jordan', 'Luna', 'Leilani', 'Eliza', 'Mckenna', 'Angel', 'Genevieve', 'Makenna', 'Isla', 'Lola', 'Danielle', 'Chelsea', 'Leila',
  'Tessa', 'Camille', 'Mikayla', 'Adeline', 'Sienna', 'Esther', 'Jacqueline', 'Emerson', 'Arabella', 'Maggie', 'Athena', 'Lucia', 'Lexi', 'Ayla', 'Diana',
  'Alexia', 'Juliet', 'Josie', 'Allyson', 'Addyson', 'Delaney', 'Teagan', 'Marley', 'Amber', 'Rose', 'Erin', 'Leslie', 'Kayleigh', 'Amanda', 'Kathryn',
  'Kelsey', 'Emilia', 'Alina', 'Kenzie', 'Alicia', 'Alison', 'Paris', 'Sabrina', 'Ashlynn', 'Sierra', 'Cassidy', 'Laura', 'Alondra', 'Iris', 'Kyla',
  'Christina', 'Carly', 'Jillian', 'Madilyn', 'Kyleigh', 'Madeleine', 'Cadence', 'Nina', 'Evangeline', 'Nadia', 'Lyric', 'Giuliana', 'Briana', 'Georgia',
  'Haylee', 'Fatima', 'Phoebe', 'Selena', 'Charlie', 'Dakota', 'Annabella', 'Abby', 'Daniella', 'Juliette', 'Bianca', 'Mariana', 'Miriam', 'Parker',
  'Veronica', 'Gemma', 'Noelle', 'Cheyenne', 'Marissa', 'Heaven', 'Vivienne', 'Joanna', 'Mallory', 'Aubrie', 'Tatum', 'Carmen', 'Gia', 'Jazmine', 'Heidi',
  'Miley', 'Baylee', 'Macy', 'Ainsley', 'Jane', 'Anastasia', 'Adelaide', 'Ruth', 'Camryn', 'Kiara', 'Alessandra', 'Hanna', 'Finley', 'Maddison', 'Lia',
  'Bethany', 'Karen', 'Kelly', 'Malia', 'Jazmin', 'Jayda', 'Esmeralda', 'Kira', 'Lena', 'Kamryn', 'Kamila', 'Karina', 'Eloise', 'Kara', 'Elisa', 'Rylie',
  'Olive', 'Nayeli', 'Tiffany', 'Macie', 'Skyler', 'Angelica', 'Fernanda', 'Annie', 'Jayden', 'Caitlyn', 'Elle', 'Crystal', 'Julie', 'Imani', 'Kendra',
  'Talia', 'Angelique', 'Jazlyn', 'Guadalupe', 'Alejandra', 'Emely', 'Lucille', 'Anya', 'April', 'Elsie', 'Scarlet', 'Helen', 'Breanna', 'Kyra', 'Madisyn',
  'Rosalie', 'Brittany', 'Arielle', 'Karla', 'Kailey', 'Arya', 'Sarai', 'Harley', 'Miracle', 'Kali', 'Cynthia', 'Daphne', 'Caitlin', 'Cassandra', 'Holly',
  'Janelle', 'Marilyn', 'Katelynn', 'Kaylie', 'Itzel', 'Carolina', 'Bristol', 'Haven', 'Michaela', 'Monica', 'June', 'Camilla', 'Jamie', 'Rebekah', 'Lana',
  'Serena', 'Tiana', 'Braelyn', 'Savanna', 'Skye', 'Raelyn', 'Madalyn', 'Sasha', 'Perla', 'Bridget', 'Aniya', 'Rowan', 'Logan', 'Aylin', 'Joselyn', 'Nia',
  'Hayley', 'Lilian', 'Kassidy', 'Kaylin', 'Celeste', 'Tatiana', 'Jimena', 'Lilyana', 'Catalina', 'Viviana', 'Sloane', 'Courtney', 'Johanna', 'Melany',
  'Francesca', 'Ada', 'Alanna', 'Priscilla', 'Danna', 'Angie', 'Kailyn', 'Lacey', 'Sage', 'Lillie', 'Joy', 'Vera', 'Bailee', 'Amira', 'Aileen', 'Aspen',
  'Erica', 'Danica', 'Dylan', 'Kiley', 'Gwendolyn', 'Jasmin', 'Lauryn', 'Justice', 'Annabel', 'Dahlia', 'Gloria', 'Lexie', 'Lindsey', 'Hallie', 'Sylvia',
  'Elyse', 'Annika', 'Maeve', 'Marlee', 'Kenya', 'Lorelei', 'Selah', 'Adele', 'Natasha', 'Brenda', 'Erika', 'Alyson', 'Emilee', 'Raven', 'Ariella', 'Liana',
  'Sawyer', 'Elsa', 'Farrah', 'Cameron', 'Luciana', 'Zara', 'Eve', 'Kaia', 'Helena', 'Anne', 'Estrella', 'Leighton', 'Whitney', 'Lainey', 'Amara', 'Anabella',
  'Samara', 'Zoie', 'Amani', 'Phoenix', 'Dulce', 'Paola', 'Marie', 'Aisha', 'Harlow', 'Virginia', 'Regina', 'Jaylee', 'Anika', 'Ally', 'Kayden', 'Kiera',
  'Nathalie', 'Mikaela', 'Charley', 'Claudia', 'Aliya', 'Madyson', 'Cecelia', 'Liberty', 'Evie', 'Rosemary', 'Lizbeth', 'Ryan', 'Teresa', 'Ciara', 'Isis',
  'Lea', 'Shayla', 'Rosa', 'Desiree', 'Elisabeth', 'Isabela', 'Mariam', 'Brenna', 'Kaylynn', 'Nova', 'Raquel', 'Dana', 'Laney', 'Siena', 'Amelie', 'Clarissa',
  'Halle', 'Maleah', 'Linda', 'Shiloh', 'Jessie', 'Greta', 'Marina', 'Melina', 'Natalee', 'Sariah', 'Mollie', 'Nancy', 'Christine', 'Felicity', 'Zuri',
  'Irene', 'Simone', 'Matilda', 'Colette', 'Kristen', 'Kallie', 'Mira', 'Hailee', 'Kathleen', 'Meredith', 'Janessa', 'Noemi', 'Leia', 'Tori', 'Alissa',
  'Ivanna', 'Sandra', 'Maryam', 'Kassandra', 'Danika', 'Denise', 'Jemma', 'River', 'Emelia', 'Kristina', 'Beatrice', 'Jaylene', 'Karlee', 'Blake', 'Cara',
  'Amina', 'Ansley', 'Kaitlynn', 'Iliana', 'Mckayla', 'Adelina', 'Elaine', 'Mercedes', 'Chaya', 'Lindsay', 'Hattie', 'Lisa', 'Marisol', 'Patricia', 'Bryanna',
  'Adrienne', 'Emmy', 'Millie', 'Kourtney', 'Leyla', 'Maia', 'Willa', 'Milan', 'Paula', 'Clare', 'Reyna', 'Martha', 'Emilie', 'Yasmin', 'Amirah', 'Aryana',
  'Livia', 'Alena', 'Kiana', 'Celia', 'Kailee', 'Rylan', 'Ellen', 'Leanna', 'Renata', 'Mae', 'Chanel', 'Lesly', 'Cindy', 'Carla', 'Pearl', 'Jaylin',
  'Angeline', 'Edith', 'Alia', 'Frances', 'Corinne', 'Cherish', 'Wendy', 'Carolyn', 'Lina', 'Tabitha', 'Winter', 'Bryn', 'Jolie', 'Casey', 'Zion', 'Jayde',
  'Jaida', 'Salma', 'Diamond', 'Ryann', 'Abbie', 'Paloma', 'Destinee', 'Kaleigh', 'Asia', 'Demi', 'Deborah', 'Elin', 'Mara', 'Nola', 'Tara', 'Taryn', 'Janae',
  'Jewel', 'Sonia', 'Heather', 'Shannon', 'Giada', 'Lilith', 'Sharon', 'Eileen', 'Julianne', 'Regan', 'Krystal', 'Sidney', 'Hadassah', 'Macey', 'Mina',
  'Paulina', 'Kaitlin', 'Maritza', 'Susan', 'Raina', 'Hana', 'Temperance', 'Aimee', 'Charlize', 'Kendal', 'Lara', 'Roselyn', 'Alannah', 'Alma', 'Dixie',
  'Larissa', 'Patience', 'Sky', 'Zaria', 'Elliot', 'Jenny', 'Luz', 'Ali', 'Alisha', 'Campbell', 'Azaria', 'Blair', 'Micah', 'Moriah', 'Myra', 'Lilia',
  'Aliza', 'Giovanna', 'Karissa', 'Emory', 'Estella', 'Juniper', 'Kenna', 'Meghan', 'Elissa', 'Rachael', 'Emmaline', 'Jolene', 'Joyce', 'Britney', 'Carlie',
  'Haylie', 'Judith', 'Renee', 'Yesenia', 'Barbara', 'Dallas', 'Jaqueline', 'America', 'Azalea', 'Ingrid', 'Marianna', 'Leona', 'Libby', 'Deanna', 'Mattie',
  'Kai', 'Annalee', 'Dorothy', 'Kaylyn', 'Rayna', 'Araceli', 'Cambria', 'Evalyn', 'Haleigh', 'Thalia', 'Charity', 'Tamia', 'Carley', 'Katrina', 'Belen',
  'Natalya', 'Celine', 'Milana', 'Monroe', 'Estelle', 'Meadow', 'Cristina', 'Zahra', 'Akira', 'Ann', 'Anabel', 'Azariah', 'Carissa', 'Milena', 'Tia', 'Alisa',
  'Bree', 'Cheyanne', 'Laurel', 'Kora', 'Marisa', 'Esme', 'Sloan', 'Cailyn', 'Gisselle', 'Kasey', 'Marlene', 'Riya', 'Izabelle', 'Kirsten', 'Aya', 'Devyn',
  'Geraldine', 'Hayleigh', 'Sofie', 'Tess', 'Jessa'
]
BalancedUnitTestsHelper.prototype.createTestMerchant = function(options, callback) {
  if (!this.options) this.options = {};
  _.extend(this.options, options);
  //var email = this.options.email
  var firstName = names[Math.floor(Math.random() * names.length)],
    lastName = names[Math.floor(Math.random() * names.length)],
    marketplace = this.options.marketplace,
    _uuid = this.options.uuid,
    now = Date.now()
    //Mock merchant info
    ,
    randomCompanyName = names[Math.floor(Math.random() * names.length)],
    companyName = randomCompanyName + ' Commercial RE, LLC',
    companyEmail = firstName[0].toLowerCase() + lastName.toLowerCase() + '@' + randomCompanyName.toLowerCase() + 'cre.com'
  var email = _uuid + '@hotmail.com';
  db.zadd(marketplace + ':merchants', new Date()
    .setHours(0, 0, 0, 0), _uuid);
  db.set(marketplace + ':' + email + ':uuid', _uuid);
  db.set(_uuid + ':email', email);
  db.zadd(this.options.marketplace + ':users', now, email);
  db.hmset(this.options.marketplace + ':' + email, {
    email: email,
    firstName: firstName,
    lastName: lastName,
    joined: now,
    uuid: _uuid,
    type: 'merchant',
    companyName: companyName,
    companyEmail: companyEmail
  });
};
BalancedUnitTestsHelper.prototype.createTesters = function(num, callback) {
  var self = this;
  async.each(_.range(num), function(i, cb) {
    var email = 'tester-' + i + '@gmail.com',
      firstName = names[Math.floor(Math.random() * names.length)],
      lastName = names[Math.floor(Math.random() * names.length)],
      now = Date.now() + i;
    db.zadd(self.options.marketplace + ':users', i, email);
    db.lpush(self.options.marketplace + ':users:testers', email);
    db.hmset(self.options.marketplace + ':' + email, {
      email: email,
      firstName: firstName,
      lastName: lastName,
      joined: now,
      type: 'investor'
    });
    if (i == num - 1) {
      db.ltrim(self.options.marketplace + ':users:testers', 0, num - 1, function(err, resp) {
        if (cb) {
          cb(null);
        }
        if (callback) return callback(null);
      });
    }
  });
}
BalancedUnitTestsHelper.prototype.backInvestment = function(options) {
  /*
	{
		marketplace: socket.domain
		merchant: (merchant uuid)
		email:
		name:
		campaignId:
		campaignName
		amount:
	}
	*/
  var buffer = new Buffer(16);
  uuid.v4({
    rng: uuid.nodeRNG
  }, buffer, 0);
  var _uuid = uuid.unparse(buffer)
    .replace(/-/g, '');
  var now = Date.now(),
    midnite = new Date()
    .setHours(0, 0, 0, 0),
    rec = now + ',' + _uuid + ',' + options.campaignId + ',' + options.campaignName + ',' + options.email + ',' + options.name + ',' + options.amount;
  //All this information should be provided on the client	
  var newrec = {
    datetime: now,
    merchant: options.merchant,
    merchantName: ('Developer:' + options.merchant)
      .slice(0, 22),
    campaignId: options.campaignId,
    campaignName: options.campaignName,
    email: options.email,
    name: options.name,
    amount: options.amount
  };
  //Shared by all
  db.hmset(_uuid, newrec);
  //Marketplace?
  db.incrby(options.marketplace + ':invest:debits:total', options.amount);
  //db.lpush(options.marketplace + ':invest:debits:log', rec);
  db.lpush(options.marketplace + ':invest:debits:uuids', _uuid);
  db.zincrby(options.marketplace + ':invest:debits:users', options.amount, options.email);
  db.zincrby(options.marketplace + ':invest:debits:campaigns', options.amount, options.campaignId);
  db.zincrby(options.marketplace + ':invest:debits:day', options.amount, options.email);
  //Merchant
  db.incrby(options.merchant + ':invest:debits:total', options.amount);
  //db.lpush(options.merchant + ':invest:debits:log', rec);
  db.lpush(options.merchant + ':invest:debits:uuids', _uuid);
  db.zincrby(options.merchant + ':invest:debits:users', options.amount, options.email); //used for email module
  db.zincrby(options.merchant + ':invest:debits:campaigns', options.amount, options.campaignId);
  db.zincrby(options.merchant + ':invest:debits:day', options.amount, options.email);
  //Campaign
  db.incrby(options.campaignId + ':invest:debits:total', options.amount);
  //The following used by Balanced-Cron
  //123456789abcdefg:offeringaummary:1:invest:debits:uuids
  db.lpush(options.campaignId + ':invest:debits:uuids', _uuid);
  db.zincrby(options.campaignId + ':invest:debits:users', options.amount, options.email);
  db.zincrby(options.campaignId + ':invest:debits:day', options.amount, midnite);
  //User
  db.incrby(options.marketplace + ':' + options.email + ':invest:debits:total', options.amount);
  db.lpush(options.marketplace + ':' + options.email + ':invest:debits:uuids', _uuid);
  //db.lpush(options.marketplace + ':' + options.email + ':invest:debits:log', rec);				
  db.zincrby(options.marketplace + ':' + options.email + ':invest:debits:campaigns', options.amount, options.campaignId); //zcard
  db.zincrby(options.marketplace + ':' + options.email + ':invest:debits:day', options.amount, midnite);
}
BalancedUnitTestsHelper.prototype.pickRandomInvestors = function(num, cb) {
  function roundAccuracy(num, acc) {
    var factor = Math.pow(10, acc);
    return Math.round(num * factor) / factor;
  }

  function randomFromInterval(from, to) {
    return roundAccuracy(Math.floor(Math.random() * (to - from + 1) + from), -3);
  }
  var self = this;
  var investors = [];
  /* There are 10K users.  1% will invest  1/100 */
  for (var i = 0; i < num; i++) {
    if (i % (num / 10) == 0) investors.push(i);
  }
  var multi = db.multi();
  for (var i = 0; i < investors.length; i++) {
    //Get user at
    multi.lindex(self.options.marketplace + ':users:testers', investors[i]);
  }
  multi.exec(function(err, arr) {
    _.each(arr, function(email, i) {
      db.hgetall(self.options.marketplace + ':' + email, function(err, user) {
        if (user.type == 'investor') {
          self.backInvestment({
            marketplace: self.options.marketplace,
            merchant: self.options.merchant,
            email: user.email,
            name: user.firstName + ' ' + user.lastName,
            campaignId: self.options.campaignId,
            campaignName: self.options.campaignName,
            amount: randomFromInterval(5000, 100000)
          });
        }
      });
      if (i == arr.length - 1) {
        if (cb) cb(null);
      }
    });
  });
}
module.exports = exports = BalancedUnitTestsHelper;