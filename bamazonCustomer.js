// Require Node modules for access
const inquirer = require('inquirer');
const mysql = require('mysql');
const sqlCreds = require('./sql-connection');

// create the SQL DB connection pool
// use module to hide credentials
// create listeners to report acquired and released connections
let sqlPool = mysql.createPool(sqlCreds);

sqlPool.on('acquire', function (connection) {
    console.log(`Connection ${connection.threadId} acquired`);
});

sqlPool.on('release', function (connection) {
    console.log(`Connection ${connection.threadId} released`);
});

// function to list the inventory from the products table
// takes in a callback that handles the data after it is displayed
function listInventory(fCallback) {
    // get DB connection from the pool
    sqlPool.getConnection(function (err, connection) {
        if (err) {console.log(err); sqlPool.end(); return;}

        // send query to DB to get the products
        connection.query('SELECT * FROM products', function (err, data, fields) {
            if (err) { console.log(err); connection.release(); }

            // if a callback is provided we can assume this is Customer level
            else if (fCallback) {
                // loop through the data array and list all products in the CLI
                console.log('<--------------[ Products for Sale ]-------------->');
                console.log('   ---------------------------------------------   ');
                data.forEach(function (each) {
                    console.log(`${each.item_id} | $${each.price} | ${each.product_name} (${each.department_name})`);
                    console.log('   ---------------------------------------------   ');
                });

                // release connection since we have the data
                connection.release();

                // callback to handle the data once it's retrieved and reported
                fCallback(data);
            }
            else {
                // loop through the data array and list all products in the CLI
                // add the quantity since this is Manager level (no callback provided to handle data afterward)
                console.log('<---------------------[ Products for Sale ]--------------------->');
                console.log('   -----------------------------------------------------------');
                data.forEach(function (each) {
                    console.log(`${each.item_id} | Qty: ${each.stock_quantity} @ $${each.price}/ea | ${each.product_name} (${each.department_name})`);
                    console.log('   -----------------------------------------------------------');
                });

                // release connection since we have the data
                connection.release();
            }
        });
    });
}

// Function to get the order from the customer
// pass in the data array so it can be checked by the checkID function
let placeOrder = function (pData) {
    let questions = [
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
    let dataIndex = parseInt(pOrder.selection) - 1;
    let stockQuantity = pData[dataIndex].stock_quantity;
    let desiredQuantity = parseInt(pOrder.quantity);
    let itemName = pData[dataIndex].product_name;

    // if we have enough in stock, create the order
    if (desiredQuantity <= stockQuantity) {
        // sell to the customer
        console.log('Processing order...');

        // get new connection
        sqlPool.getConnection(function (err, connection) {
            if (err) { console.log(err); return;}

            // set up variables for the order (how many, and the total price)
            let newQuantity = stockQuantity - desiredQuantity;
            let orderValue = desiredQuantity * pData[dataIndex].price;

            // query the connection to update the stock value
            connection.query('UPDATE products SET stock_quantity = ? WHERE item_id = ?', [newQuantity, pOrder.selection],
                function (err, data, fields) {
                    if (err) { console.log(err); connection.release(); }
                    else {
                        console.log('<--------------[ Order Receipt ]-------------->');
                        console.log(`  ${desiredQuantity}x ${itemName} \n`);
                        console.log(`  Total cost: $${orderValue}`);
                        console.log(' ---------------------------------------------');

                        connection.release();
                    }
            });
        });
    }
    // otherwise if we dont have enough in stock alert and don't sell
    else {
        console.log(`We don't have enough ${itemName} in stock!`);
    }

    // close pool since we're done.
    // sqlPool.end();
}

// helper function to check if the input ID is within the product array
// returns true or false
function checkID (pData, pID) {
    for (let i = 0; i < pData.length; i++) {
        // check if the ID is in the Data Array
        // and if it can be parsedInt at the same time
        if (parseInt(pID) === pData[i].item_id) {
            return true;
        }
    }
    return false;
}

// function to handle the manager CLI
// uses inquirer to figure out what to do
function managerOptions () {
    inquirer.prompt([
        {
            type: 'list',
            name: 'action',
            message: 'What would you like to do?',
            choices: ['View Products for Sale', 'View Low Inventory', 'Add to Inventory', 'Add New Product']
        }
    ]).then(function (answer) {
        switch (answer.action) {
            case 'View Products for Sale':
                return listInventory();
            case 'View Low Inventory':
                return lowInventory();
            case 'Add to Inventory':
                break;
            case 'Add New Product':
                break;
            default:
                console.log('Error in menu selection... Aborting.');
                sqlPool.end();
                return;
        }
    });
}

// show products with inventory less than 5
function lowInventory() {
    sqlPool.getConnection(function (err, connection) {
        connection.query('SELECT * FROM products WHERE stock_quantity < 5',
            function (err, data, fields) {
                if (err) {
                    console.log(err);
                    connection.release();
                }

                // if a callback is provided we can assume this is Customer level
                else {
                    // loop through the data array and list all products in the CLI
                    console.log('<--------------[ Low Inventory]-------------->');
                    console.log('   ----------------------------------------   ');
                    data.forEach(function (each) {
                        console.log(`${each.item_id} | Qty: ${each.stock_quantity} | ${each.product_name}`);
                        console.log('   ----------------------------------------   ');
                    });

                    // release connection since we have the data
                    connection.release();
                }
            });
    });
}


// ---------------------------------------------- //
//                  RUN NODE                      //
// ---------------------------------------------- //

// IIFE function to login
// named in case we want to call it later (after logout)
(function login () {
    inquirer.prompt([
        {
            type: 'list',
            name: 'account',
            message: 'Customer or Employee?',
            choices: ['Customer', 'Manager']
        }
    ]).then(function (answer) {
        switch (answer.account) {
            case 'Customer':
                return listInventory(placeOrder);
            case 'Manager':
                return managerOptions();
            default:
                console.log('Error in menu selection... Aborting.');
                sqlPool.end();
                return;
        }
    });
})();