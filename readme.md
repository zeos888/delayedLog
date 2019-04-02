A simple application server that prints a message at a given time in the future.
The server has only 1 API:

echoAtTime - which receives two parameters, time and message, and writes that message to the server console at the given time.

Server is able to withstand restarts it uses redis to persist the messages and the time they should be sent at. There might be more than one server running behind a load balancer, but any given message should be printed on one and only one server.

In case the server was down when a message will be printed, it should print it out when going back online.

Server is configurable. By default it uses json config (example may be found in [docs](docs/example-config.json)).

To use it, you need an instance of redis. The easiest way to have it is install docker image. An example of docker-compose.yml for it can be found in [redis](redis/docker-compose.yml).

To run application server, use
```shell
npm run start
```
To gently stop it, press Ctrl+C (or send SIGINT in any convenient way), this will release resources, such as port.

Server accepts POST requests with JSON body:
```json
{
	"time": "2019-04-21 20:00:00",
	"message": "whatever"
}
```
Parameter "time" should be ISO date-compatible string. Parameter "message" can be anything:
```json
{
	"time": "2019-04-21 20:00:00",
	"message": {
		"abra": "cadabra"
	}
}
```
Server will return
* OK if message is accepted
* BAD_REQUEST if message does not have "time" and "message" inside JSON body
* ERROR if anything goes unexpected way, like redis suddenly dies