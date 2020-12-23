#!/usr/local/bin/python

import requests
import os
import re
from telegram import Update
from telegram.ext import Updater, CommandHandler, CallbackContext , ConversationHandler , MessageHandler , Filters
import json

# tokens
token_loc = '/mnt/e/Python/PSETools/data/tokens.json'

with open( token_loc , 'r' ) as tokenfile :
	data = tokenfile.read()

tokenobj = json.loads( data )

telegram_tok = tokenobj[ 'telegram' ]
# tokens

# Global
resp = []
stocklist = []
# Global

QUOTE , DESCRIBE = range( 2 )

# TG Entrypoints
def help_section( update: Update, context: CallbackContext) -> int:
	message = (
		f"""Hello {update.effective_user.first_name} choose from the following modes
		/quote check price
		/describe describe based on indicator(s)
		/end to end session
		"""
	)

	update.message.reply_text(message)

	return -1

def quote(update: Update, context: CallbackContext) -> int:
	message = (
		f"""Mode is Quote
		Syntax:
			QUOTE <SYMBOL>
		"""
	)
	update.message.reply_text(message)

	return QUOTE

def	fetch_stock(update: Update , context: CallbackContext) -> int:

	url = "http://localhost:8000/quote/" + context.match[1].upper()

	try : 
		req = requests.get( url )
		data = req.json()

		if data[ 'status' ] == "WRONG":
			update.message.reply_text("Invalid Stock Code try again")

			return QUOTE
		else :
			update.message.reply_text(f"""Stock : {data[ 'status' ][ 'symbol' ]}
				Closing : {data[ 'status' ][ 'close' ]}
				Open : {data[ 'status' ][ 'open' ]}
				High : {data[ 'status' ][ 'high' ]}
				Low : {data[ 'status' ][ 'low' ]}
				""")

	except requests.exceptions.ConnectionError as e:
		update.message.reply_text("Service Unavailable")

	return -1

def describe(update: Update, context: CallbackContext) -> int:
	message = (
		f"""Mode is Describe
		Syntax:
			DESCRIBE <SYMBOL> <INDICATOR-INDICATORN>
		Ex:
			DESCRIBE SMC2C MA20-MA50
		"""
	)
	update.message.reply_text(message)

	return DESCRIBE

def fetch_description(update: Update , context: CallbackContext) -> int :

	message = ( 
		f"""
			WIP
		""" 
	)

	update.message.reply_text(message)

	return -1

def cancel(update: Update, context: CallbackContext) -> int:
	update.message.reply_text(f'Bye {update.effective_user.first_name}')

	return -1
# TG Entrypoints

print( "Starting TG Bot" )
updater = Updater( telegram_tok , use_context = True )

updater.dispatcher.add_handler( ConversationHandler( 
	entry_points = [ CommandHandler( 'help' , help_section ) , CommandHandler( 'quote' , quote ) , CommandHandler( 'describe' , describe ) ] ,
	states = {
			QUOTE : [ MessageHandler( Filters.regex( re.compile( r'QUOTE (\w+)' , re.IGNORECASE ) ) , fetch_stock ) ] ,
			DESCRIBE : [ MessageHandler( Filters.regex( re.compile( r'DESCRIBE (?P<SYMBOL>\w+) (?P<INDICATORS>(\w+.*))' , re.IGNORECASE ) ) , fetch_description ) ]
	},
	fallbacks = [ CommandHandler( 'end' , cancel ) ] 
	) )

updater.start_polling()
updater.idle()
