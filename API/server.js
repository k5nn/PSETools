//External Deps
const Hapi = require('@hapi/hapi');
const mongo = require( 'mongodb' );
const chalk = require( 'chalk' );
//External Deps

//Globals
const d = new Date()
const db_url = "mongodb://localhost:27017"
const dbName = "pse"
const client = mongo.MongoClient( `${db_url}/${dbName}` , {
	useNewUrlParser: true, 
	useUnifiedTopology: true,
})
const connection = client.connect()
//Globals

const log_msg = ( message , type , request ) => {

	let color = null

	switch( type ) {
		case 'START ' :
			color = "green"
		break;
		case 'ERROR ' :
			color = "red"
		break;
		case 'REDIR ' :
			color = "yellow"
		break;
		default :
			color = "grey"
		break;
	}

	if ( request != null || request != undefined ) {
		const ip = RequestIp.getClientIp(request)
		console.log( `${d.toString().split( '(' )[0]}: ${chalk.keyword( color )(type)} : ${ip} : ${message}` )
	} else {
		console.log( `${d.toString().split( '(' )[0]}: ${chalk.keyword( color )(type)} : ${message}` )
	}

}

const check_db = async () => {

	const require_cols = [ "price" , "config" ]

	const connect = connection

	await connect.then( async () => {
		const db = client.db( dbName )
		const cols = await db.listCollections().toArray()

		if ( cols.length == 0 || cols.length != require_cols.length ) {
			for (var i = 0; i < require_cols.length; i++) {

				if (cols[i] !== undefined ) {
					if( cols[i].name == require_cols[i] ) {
						continue
					}
				}

				await db.createCollection( require_cols[i] )
			}

			const insert = { APP_INITIALIZED : false }
			const config_col = db.collection( "config" )

			await config_col.find( {} )
				.toArray()
				.then( data => {
					if ( data.length == 0 ) {
						const config_bulkOp = config_col.initializeOrderedBulkOp();

						config_bulkOp.insert( insert )

						config_bulkOp.execute().then( ( err , res ) => {
							( err.result.ok )
								? log_msg( `check_db : Init Config Done` , 'INFO  ' )
								: Log.Info( `check_db : Init Config Failed` , 'INFO  ' )
						})
					}
				})
		} else {
			log_msg( `Init Done Skipping` , 'INFO  ' )
		}
	})

}

const start = async() => {

	const server = Hapi.server({
		port : 8000 , 
		host : 'localhost'
	})
	const connect = connection

	server.route({

		method : 'GET' ,
		path : '/quote/{symbol}' ,
		handler : async ( request , h ) => {
			let params = request.params
			let res = null
			const retn = await connect.then( async () => {
				const db = client.db( dbName );
				const col = db.collection( 'price' );
				const find = { 'Date' : `${d.getMonth() + 1}-${d.getDate()}-${d.getFullYear()}` }

				res = await col.find( find )
							   .toArray()
							   .then( data => {

									for (var i = 0; i < data[0].stock_data.length; i++) {

										if ( data[0].stock_data[i].symbol == params.symbol ) {
											log_msg( `Quote ${params.symbol}` , 'INFO  ' )
											return Promise.all( [ data[0].stock_data[i] ] )
										}

									}

									log_msg( `Stock Code Invaliid` , 'INFO  ' )
									return Promise.all( [ "WRONG" ] )
							   })

				return Promise.all( res )
			})

			return h.response( { status : retn[0] } )

		}

	})

	await server.start()
	log_msg( `Server start at ${server.info.uri}` , 'INFO  ' )

}

check_db()

start()
