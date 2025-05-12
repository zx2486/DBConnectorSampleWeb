# DBConnectorSampleWeb
This module provides some sample web server to demo how DBConnectorToolkit can help under different situations.

There are four sample setup:
1) simple-web. Just a react web, a expressJS backend server and postgres database, the example client-server website we may learn in web 101 course.
2) web-with replica. Server with master database and replica. All read queries will go to replica. This shows how simple it is to migrate from single master to master + read replica.
2) web-with-redis. Introduce redis to cache database queries, also we use redis to perform some tasks like login and API rate control.
Check the app.js, there are scripts to build cache on some "popular" queries before the server is up.
3) web-with-kafka-producing. Introduce kafka into the server. This server sends out kafka messages on API usage for analytics. The server is separated into frontend and API servers.
4) web-only-two-layer-front. This server acts like a client facing server (webpages + API). It provides service to clients and only connect to read replica and redis. All edit requests and analytics data will be sent to kafka for consumer to handle.
5) web-only-two-layer-consumer. This server consumes kafka messages from front server and do the processing in a centralized manner. So this consumer should only have one pod.
6) web-only-two-layer-cachelayer. This server handles the cahing logic. It will monitor the database table for changes and update redis cache accordingly. It also consumes analytics kafka messages and save some statistics in database for review. This can have more than one pod.

## Setup
First, setup the docker (docker-compose up -d)
Second, insert the database data into the database (mydatabase)
``` sh
npx knex migrate:latest
```
And then select a folder you would like to run, go to the clients folder to start the web:
``` sh
npm run dev
```
And open one more terminal, go to the server folder and start the server by:
``` sh
node server.js
```
Now you can visit the website via localhost:3000 and API server via localhost:4000

In case you woulid like to make a new migration file: 
``` sh
npx knex migrate:make a_new_script
```
After editing, bring it up or down
``` sh
npm knex migrate:up a_new_script
npm knex migrate:down a_new_script
```


