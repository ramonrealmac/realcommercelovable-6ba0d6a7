const ffi = require('ffi-napi');
const express = require('express');
const app = express();
const { Worker } = require('worker_threads');




app.get('/pdf', function(req, res){

    let worker = new Worker('./worker-pdf.js', { 
        workerData: null
    });
    
    worker.once('message', (data) => {
        res.json(data); 
    });

    worker.on("error", (msg) => {
        res.status(404).send(`error: ${msg}`);
    });
  
});


app.get('/info', function(req, res){

    let worker = new Worker('./worker-info.js', { 
        workerData: true,
    });
    
    worker.once('message', (data) => {
        res.json(data); 
    });

    worker.on("error", (msg) => {
        res.status(404).send(`error: ${msg}`);
    });
  
});
  
  
const PORT = 3333;
app.listen(PORT, ()=>{
    console.log('Rodando na porta: '+ PORT);
});
  