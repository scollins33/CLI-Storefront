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
    sqlPool.getConnection(function (err, connection) {
        if (err) {console.log(err); return;}

        connection.query('SELECT * FROM products', function (err, data, fields) {
            if (err) {
                console.log(err);
            } else {
                console.log(data[0]);
            }

            connection.release();
            sqlPool.end();
        });
    });
}

function listInventory(fCallback) {
    sqlPool.getConnection(function (err, connection) {
        if (err) {console.log(err); sqlPool.end(); return;}

        connection.query('SELECT * FROM products', function (err, data, fields) {
            if (err) {
                console.log(err);
            } else {
                console.log('<--------------[ Products for Sale ]-------------->');
                console.log('   ---------------------------------------------   ');
                data.forEach(function (each) {
                    console.log(each.item_id + ' | $' + each.price + ' | ' + each.product_name + ' (' + each.department_name + ')');
                    console.log('   ---------------------------------------------   ');
                });

                //
                fCallback(data);
            }

            connection.release();
            sqlPool.end();
        });
    });
}

var placeOrder = function (pData) {
    var questions = [
        {
            type: 'input',
            name: 'selection',
            message: 'Enter the Product ID you wish to purchase:',
            validate: function (value) {

                if (parseInt(value))
                return true;
            }
        },
        {
            type: 'input',
            name: 'quantity',
            message: 'How many units do you want?',
            validate: function (value) {
                console.log(typeof value);
                return true;
            }
        }

    ];

    inquirer.prompt(questions).then(function (answers) {
        console.log(JSON.stringify(answers));
    });
};

function processOrder() {
    return;
}

listInventory(placeOrder);