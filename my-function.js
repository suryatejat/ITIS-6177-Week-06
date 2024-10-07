const functions = require('@google-cloud/functions-framework');

functions.http('helper', (req, res) => {
  res.send(`Surya Teja says ${req.query.param}`);
});
