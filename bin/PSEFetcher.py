#!/usr/local/bin/python

import requests
from datetime import date , datetime
from time import time
from pymongo import MongoClient
from bson.timestamp import Timestamp
import json
import sys , getopt

debug_mode = False
logfile='/mnt/e/Python/PSETools/logs/PSEFetch.log'
now = datetime.now()
mdy_hms = now.strftime( "%c" )

def fetch_pse( bool_push ) :
	tokenfile='/mnt/e/Python/PSETools/data/tokens.json'
	stocklist = []
	url = "https://www.pse.com.ph/stockMarket/home.html"
	payload = { 'method' : 'getSecuritiesAndIndicesForPublic' ,
				'ajax' : 'true' ,
				'_dc' : str( int( time() * 1000 ) ) }

	client = MongoClient( 'mongodb://localhost:27017' )
	db = client[ 'pse' ]
	today = date.today()
	first_insert = False
	hi_lo_arr = []
	open_price=0

	with open( tokenfile , 'r' ) as tokenfile :
		data = tokenfile.read()

	tokenobj = json.loads( data )

	headers = { 'Cookie' : tokenobj[ 'psetoken' ] }

	try :
		req = requests.get( url , params=payload , headers=headers )
	except requests.exceptions.ConnectionError as e:
		return [ "Connection Error" ]
	
	try:
		req.json()
	except ValueError as e:
		return [ "Renew PSEToken" ]
	else:

		entries = req.json()

		if len( entries ) > 0:
			push_entry = { 'Date' : f"""{today.month}-{today.day}-{today.year}""" }

			entry_db = db.price.find( push_entry )

			if entry_db.count() == 0:
				first_insert = True
				push_db = db.price.insert( push_entry )

			if first_insert is False:
				current_db = db.price.find( push_entry )
				
				for dataset in current_db.next()[ "stock_data" ] :
					hi_lo_arr.append( { 'symbol' : dataset[ "symbol" ] , 'high' : dataset[ "high" ] , 'low' : dataset[ 'low' ] } )


			for ctr in range( len( req.json() ) ) :

				if entries[ ctr ][ "securityAlias" ] == "PSEi" :
					break

				if ( entries[ ctr ][ "securityAlias" ] == "PSE" or entries[ ctr ][ "lastTradedPrice" ] == "DATE" ) :
					continue

				
				open_price = round( float( ( entries[ ctr ][ "lastTradedPrice" ] ).replace( ',' , '' ) ) *
										( 1 + ( float( ( entries[ ctr ][ "percChangeClose" ] ).replace( ',' , '' ) ) / 100 ) )
								 , 2 )

				stocklist.append( {
							'symbol' : entries[ ctr ][ "securitySymbol" ] ,
							'close' : round( float( entries[ ctr ][ "lastTradedPrice" ].replace( ',' , '' ) ) , 2 ) ,
							'open' : open_price ,
							'high' : round( float( entries[ ctr ][ "lastTradedPrice" ].replace( ',' , '' ) ) , 2 ) ,
							'low' : round( float( entries[ ctr ][ "lastTradedPrice" ].replace( ',' , '' ) ) , 2 ) ,
						} )

				try :
					if stocklist[ ctr - 1 ][ 'open' ] > stocklist[ ctr - 1 ][ 'high' ] : 
						stocklist[ ctr - 1 ][ 'high' ] = stocklist[ ctr - 1 ][ 'open' ]
					
					if stocklist[ ctr - 1 ][ 'open' ] < stocklist[ ctr - 1 ][ 'low' ] :
						stocklist[ ctr - 1 ][ 'low' ] = stocklist[ ctr - 1 ][ 'open' ]
				except IndexError :
					pass

				if first_insert is False :
					try:
						if hi_lo_arr[ ctr - 1 ][ 'symbol' ] == entries[ ctr ][ "securitySymbol" ] :
							if stocklist[ ctr - 1 ][ 'open' ] > hi_lo_arr[ ctr - 1 ][ 'high' ] :
								stocklist[ ctr - 1 ][ 'open' ] = hi_lo_arr[ ctr - 1 ][ 'high' ]

							if stocklist[ ctr - 1 ][ 'open' ] < hi_lo_arr[ ctr - 1 ][ 'low' ] :
								stocklist[ ctr - 1 ][ 'open' ] = hi_lo_arr[ ctr - 1 ][ 'low' ]
					except IndexError :
						continue

			if bool_push :
					push_db = db.price.update_one( push_entry , { '$set' : { 'stock_data' : stocklist } } )

			return[ "Processed " + str( len( entries ) ) + " entries" ]

		else :
			return [ "No Data to Process" ]
	
