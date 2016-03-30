//Packages, models and configurations
var express = require('express');
var app = express();
var bodyParser = require('body-parser');
var router = express.Router();
var morgan = require('morgan');
var mongoose = require('mongoose');
var jwt = require('jsonwebtoken');
var User = require('./models/user');
var Board = require('./models/board');
var Card = require('./models/card');
var env = process.env.NODE_ENV;
var config = require('./config')[env];

//Configuration
mongoose.connect(config.db); //connect to database
app.set('secret', config.secret); //secret variable
app.use(morgan("dev")); //log the requests to the console
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({"extended" : false}));

/*===========================
          User API
============================*/

//login with existing user
// body: username, password
// params: ...
// headers: ...
router.post('/users/authenticate', function(req, res) {
  User.findOne({
    username: req.body.username
  }, function(err, user) {
    if (err) throw err;
    if (!user) { //If user does not exists
      res.json({ "success": false, "message": 'Authentication failed. User not found.' });
    } else if (user) { //If user exists
      //Check if password matches
      user.comparePassword(req.body.password, function(err, isMatch) {
        if (err) throw err;
        if(!isMatch) { //if password does not match
          res.json({ "success": false, "message": 'Authentication failed. Wrong password.' });
        } else {
          //if password is right, create a token
          var token = jwt.sign(user, app.get('secret'), {
            expiresIn: 86400 //expires in 24 hours
          });
          res.json({ "success": true, "message": 'Successfully authenticated',
          "token": token, "user": user });
        }
      });
    }
  });
});

//register a new user
// body: username, email, password
// params: ...
// headers: ...
router.post('/users/register', function(req, res) {
  User.findOne({
    username: req.body.username
  }, function(err, user) {
    if (err) throw err;
    if (!user) { //If user does not exists
      var newUser = new User({ username: req.body.username,
        email: req.body.email,
        password: req.body.password
      });
      if(newUser.username !== undefined && newUser.email !== undefined
        && newUser.password !== undefined) {
          newUser.save(function(err) { //Save the new user
            if (err) throw err;
            //If user is registered successfully, create a token
            var token = jwt.sign(user, app.get('secret'), {
              expiresIn: 86400 //expires in 24 hours
            });
            res.json({ "success": true, "message": 'User registered successfully',
            "token": token, "user": newUser });
          });
        }
        else {
          res.json({ "success": false, "message": 'User not valid' });
        }
    } else if (user) { //If user exists
      res.json({ "success": false, "message": 'Registration failed. User already exists.' });
    }
  });
});

//close the current session of the user (delete token on the client side)
// body: ...
// params: ...
// headers: ...
router.post('/users/logout', function(req, res) {
  res.json({ "success": true, "message": 'User logout successfully' });
});

/*================================================
 route middleware to authenticate and check token
       All the requests below need token
=================================================*/
router.use(function(req, res, next) {
  //check header or post parameter for token
  var token = req.body.token || req.headers['x-access-token'];
  if (token) { //decode token
    //verifies secret and checks exp
    jwt.verify(token, app.get('secret'), function(err, decoded) {
      if (err) {
        return res.json({ success: false, message: 'Failed to authenticate token.' });
      } else {
        //if everything is good, save to request for use in other routes
        req.decoded = decoded;
        next();
      }
    });
  } else {
    //if there is no token, return an error
    return res.status(403).send({
      success: false,
      message: 'No token provided.'
    });
  }
});

//Get all registered users
// body: ...
// params: ...
// headers: x-access-token
router.get('/users', function(req, res) {
  User.find({}, function(err, users) {
    if(err) {
      res.json({"success": false, "message": "Cant get users"});
    } else {
      res.json({"success": true, "message": users});
    }
  });
});

//Get user information by ID
// body: ...
// params: id
// headers: x-access-token
router.get('/users/:id', function(req, res) {
  User.findById(req.params.id, function(err, user) {
    if(err) {
      res.json({"success": false, "message": "Cant get the user"});
    } else {
      res.json({"success": true, "message": user});
    }
  });
});

/*===========================
          Boards API
============================*/

//GET and POST
router.route("/boards")
  //Get all kanban boards for all users
  // body: ...
  // params: ...
  // headers: x-access-token
  .get(function(req, res) {
    Board.find({}, function(err, boards) {
      if(err) {
        res.json({"success": false, "message": "Error finding boards"});
      } else {
        res.json({"success": true, "message": boards});
      }
    });
  })
  //Create new board
  // body: name, description, owner
  // params: ...
  // headers: x-access-token
  .post(function(req, res) {
    Board.create({ //creates board
      name: req.body.name,
      description: req.body.description,
      owners: [ req.body.owner ]
    },
    function(err, createdBoard) {
      if(err) {
        res.json({"success": false, "message": "Error creating board"});
      } else {
        res.json({"success": true, "message": createdBoard});
      }
    });
  });

//GET, PUT and DELETE by ID
router.route('/boards/:id')
  //Get specific board by ID
  // body: ...
  // params: id
  // headers: x-access-token
  .get(function(req,res) {
    Board.findById(req.params.id, function(err, board) {
      if(err) {
        res.json({"success": false, "message": "Board not found"});
      } else {
        res.json({"success": true, "message": board});
      }
    });
  })
  //Update board by ID
  // body: name, description
  // params: id
  // headers: x-access-token
  .put(function(req,res) {
    Board.findById(req.params.id, function(err, board) {
      if(err) {
        res.json({"success": false, "message": "Board not found"});
      } else {
        if(req.body.name !== undefined) {
          board.name = req.body.name; //Edit name
        }
        if(req.body.description !== undefined) {
          board.description = req.body.description; //Edit description
        }
        board.save(function(err, savedBoard) {
          if(err) {
            res.json({"success": false, "message": "Error saving board"});
          } else {
            res.json({"success": true, "message": savedBoard});
          }
        });
      }
    });
  })
  //Remove board by ID
  .delete(function(req,res) {
    //Find the board
    // body: ...
    // params: id
    // headers: x-access-token
    Board.findById(req.params.id, function(err, board) {
      if(err) {
        res.json({"success": false, "message": "Board not found"});
      } else {
        //Remove the board
        Board.remove({_id : req.params.id}, function(err) {
          if(err) {
            res.json({"success": false, "message": "Error removing board"});
          } else {
            //Remove all cards associated to the board ID
            Card.remove({board: req.params.id}, function(err) {
              if(err) {
                res.json({"success": false, "message": "Error removing board cards"});
              } else {
                res.json({"success": true, "message": "Board with id = " + req.params.id + " deleted"});
              }
            });
          }
        });
      }
    });
  });

//GET and POST for cards
router.route('/boards/:id/cards')
  //Get all cards for a board
  // body: ...
  // params: id
  // headers: x-access-token
  .get(function(req, res) {
    Card.find({board: req.params.id}, function(err, cards) {
      if(err) {
        res.json({"success": false, "message": "Error finding cards"});
      } else {
        res.json({"success": true, "message": cards});
      }
    });
  })
  //Create new card for a board
  // body: content, category
  // params: id
  // headers: x-access-token
  .post(function(req, res) {
    Card.create({
      content: req.body.content,
      category: req.body.category,
      board: req.params.id
    }, function(err, card) {
      if(err) {
        res.json({"success": false, "message": "Error creating cards"});
      } else {
        Board.findByIdAndUpdate(
          req.params.id,
          {$addToSet: {cards: card._id}},
          function(err, board) {
          if(err) {
            res.json({"success": false, "message": "Error finding and updating board"});
          } else {
            res.json({"success": true, "message": card});
          }
        });
      }
    });
  });

//GET, PUT and DELETE by ID for cards
router.route('/boards/:boardId/cards/:cardId')
  //Get card by ID
  // body: ...
  // params: boardId, cardId
  // headers: x-access-token
  .get(function(req, res) {
    Card.findById(req.params.cardId, function(err, card) {
      if(err) {
        res.json({"success": false, "message": "Error finding card"});
      } else {
        res.json({"success": true, "message": card});
      }
    });
  })
  //Update card by ID
  // body: content, category
  // params: boardId, cardId
  // headers: x-access-token
  .put(function(req, res) {
    Card.findById(req.params.cardId, function(err, card) {
      if(err) {
        res.json({"success": false, "message": "Card not found"});
      } else {
        if(req.body.content !== undefined) {
          card.content = req.body.content; //Edit content
        }
        if(req.body.category !== undefined) {
          card.category = req.body.category; //Edit category
        }
        card.save(function(err, savedCard) {
          if(err) {
            res.json({"success": false, "message": "Error saving card"});
          } else {
            res.json({"success": true, "message": savedCard});
          }
        });
      }
    })
  })
  //Delete card by ID
  // body: ...
  // params: boardId, cardId
  // headers: x-access-token
  .delete(function(req, res) {
    Card.findByIdAndRemove(req.params.cardId, function(err) {
      if(err) {
        res.json({"success": false, "message": "Error finding and removing card"});
      } else {
        Board.update(
          {_id: req.params.boardId}, {$pull: {cards: req.params.cardId}},
          function(err) {
            if(err) {
              res.json({"success": false, "message": "Error removing card from board"});
            } else {
              res.json({"success": true, "message": "Card successfully removed"});
            }
          });
      }
    });
  });

//Get the kanban boards for an user
// body: ...
// params: id
// headers: x-access-token
router.route('/boards/owner/:id')
  .get(function(req, res) {
    Board.find({owners: req.params.id}, function(err, boards) {
      if(err) {
        res.json({"success": false, "message": "Error finding user boards"});
      } else {
        res.json({"success": true, "message": boards});
      }
    });
  });


//Start the server
app.use(express.static(__dirname + '/'), router);
app.listen(config.port);
console.log('Magic happens at http://localhost:' + config.port);
