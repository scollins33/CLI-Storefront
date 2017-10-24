// Require Node modules for access
var inquirer = require('inquirer');
var mysql = require('mysql');
var sqlCreds = require('./sql-connection');

// create the SQL DB connection pool
// use module to hide credentials
var sqlPool = mysql.createPool(sqlCreds);

// function to test the DB connection
// prints first item in data array if successful
function testConnection() {
    // get a connection from the pool
    sqlPool.getConnection(function (err, connection) {
        if (err) {console.log(err); return;}

        // query the DB using the connection
        connection.query('SELECT * FROM products', function (err, data, fields) {
            if (err) {
                console.log(err);
            } else {
                // report the first thing in the array to prove the query worked
                console.log(data[0]);
            }

            // release the connection back to the pool
            connection.release();
        });
    });
}

// function to list the inventory from the products table
// takes in a callback that handles the data after it is displayed
function listInventory(fCallback) {
    // get DB connection from the pool
    sqlPool.getConnection(function (err, connection) {
        if (err) {console.log(err); sqlPool.end(); return;}

        // send query to DB to get the products
        connection.query('SELECT * FROM products', function (err, data, fields) {
            if (err) {
                console.log(err);
            } else {
                // loop through the data array and list all products in the CLI
                console.log('<--------------[ Products for Sale ]-------------->');
                console.log('   ---------------------------------------------   ');
                data.forEach(function (each) {
                    console.log(each.item_id + ' | $' + each.price + ' | ' + each.product_name + ' (' + each.department_name + ')');
                    console.log('   ---------------------------------------------   ');
                });

                // callback to handle the data once it's retrieved and reported
                fCallback(data);
            }

            // release the connection back to the pool
            connection.release();
        });
    });
}

// Function to get the order from the customer
// pass in the data array so it can be checked by the checkID function
var placeOrder = function (pData) {
    var questions = [
        {
            type: 'input',
            name: 'selection',
            message: 'Enter the Product ID you wish to purchase:',
            validate: function (value) {
                // check if the ID is in the array and can be parsed
                if (checkID(pData, value)) {
                    return true;
                }
                return 'Please enter a valid ID.';
            }
        },
        {
            type: 'input',
            name: 'quantity',
            message: 'How many units do you want?',
            validate: function (value) {
                // check if the input can be parsed as an Int
                if (parseInt(value)) {
                    return true;
                }
                return 'Please enter a valid quantity.';
            }
        }

    ];

    inquirer.prompt(questions).then(function (answers) {
        processOrder(answers, pData);

    });
};

// process the order based on the inquirer results
function processOrder(pOrder, pData) {
    var intSelection = parseInt(pOrder.selection);
    var intQuantity = parseInt(pOrder.quantity);
    var dataIndex = intSelection - 1;

    console.log(intSelection);
    console.log(intQuantity);
    console.log(pData[dataIndex].stock_quantity);

    // close pool since we're done.
    closePool();
}


// helper function that closes the sql pool
// should only be used once all operations are truly done
// for an ongoing server this might be never
function closePool() {
    sqlPool.end();
}

// helper function to check if the input ID is within the product array
// returns true or false
function checkID (pData, pID) {
    for (var i = 0; i < pData.length; i++) {
        // check if the ID is in the Data Array
        // and if it can be parsedInt at the same time
        if (parseInt(pID) === pData[i].item_id) {
            return true;
        }
    }
    return false;
}


// ---------------------------------------------- //
//                  RUN NODE                      //
// ---------------------------------------------- //

listInventory(placeOrder);