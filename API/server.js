//External Deps
const hapi=require( "@hapi/hapi" )
const mongodb=require( "mongodb" )
const chalk=require( "chalk" )
//External Deps

const date = new Date()
const dbName = "pse"
const db_url = "mongodb://localhost:27017"
const client = mongodb.MongoClient( `${db_url}/${dbName}` , {
	useNewUrlParser : true ,
	useUnifiedTopology : true
})
const connection = client.connect()

const resolve_address = ( type ) => {
	let array = [];

	Object.keys( ifaces ).forEach( ( ifname ) => {
		ifaces[ ifname ].forEach( ( iface ) => {
			//skip addresses that do not match with specified type and skip 127.0.0.1
			if ( (iface.family).toUpperCase() !== type.toUpperCase() || iface.internal !== false ) { return 1 }

			array.push( iface.address );
		});
	});

	return array;
}

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
		console.log( `${date.toString().split( '(' )[0]}: ${chalk.keyword( color )(type)} : ${ip} : ${message}` )
	} else {
		console.log( `${date.toString().split( '(' )[0]}: ${chalk.keyword( color )(type)} : ${message}` )
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

				if ( cols[i] != undefined ) {
					if ( cols[i].name == require_cols[i] ) {
						continue
					}
				}

				await db.createCollection( require_cols[i] )

			}

			const insert = { APP_INITIALIZED : true }
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
								: log_msg( `check_db : Init Config Failed` , 'INFO  ' )
						})
					}
				})
		} else {
			log_msg( `Init Done Skipping` , 'INFO  ' )
		}
	})

}

const start = async() => {

	const server = hapi.server({
		port: 8000 ,
		host: 'localhost' 
	})
	const connect = connection

	server.route({
		method : 'GET' ,
		path : '/' ,
		handler : async ( request , h ) => {
			return Promise.all( [ 'this is a microservice' ] )
		}
	})

	server.route({
		method : 'GET' ,
		path : '/quote/{symbol}' ,
		handler : async ( request , h ) => {
			let params = request.params
			let res = null
			const retn = await connect.then( async () => {
				const db = client.db( dbName )
				const col = db.collection( "price" )

				const find = { 'Date' : `${date.getMonth() + 1}-${date.getDate()}-${date.getFullYear()}` }

				const res = await col.find( find )
									 .toArray()
									 .then( data => {
									 	for (var i = 0; i < data[0].stock_data.length; i++) {
									 		if ( data[0].stock_data[i].symbol == params.symbol ) {
									 			return Promise.all( [ data[0].stock_data[i] ] )
									 		}
									 	}
									 	return Promise.all( [ "WRONG" ] )
									 })

				return Promise.all( [ res[0] ] )

			})

			log_msg( `Quote ${params.symbol}` , 'INFO  ' )

			return ( retn[0] == "WRONG" )
				? h.response( { status : retn[0] } ).code( 401 )
				: h.response( { status : retn[0] } )

			}

	})

	server.route({
		method : 'GET' ,
		path : '/{route}' ,
		handler : ( request , h ) => {
			let params = request.params

			if ( params.route == "favicon.ico" ) {
				return 0
			} else {
				log_msg( `from ${params.route} to /` , 'REDIR ' , request )
				return h.redirect( '/' )
			}

		}
	})

	await server.start()
	log_msg( `Started at ${server.info.uri}` , 'START ' )

}

process.on( 'unhandledRejection' , ( err ) => {
	console.log( err )
	process.exit( 1 )
})

check_db()

start()


