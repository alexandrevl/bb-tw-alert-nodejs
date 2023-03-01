import os
import openai
import asyncio
import re
import string

from pymongo import MongoClient
from datetime import datetime, timedelta

import csv
from io import StringIO

def data_to_csv(data, fields):
    # create a new StringIO object to hold the CSV data
    csv_data = StringIO()

    # create a new CSV writer object that writes to the StringIO object
    writer = csv.DictWriter(csv_data, fieldnames=fields, delimiter=';')

    # write the header row to the CSV data
    writer.writeheader()

    # iterate over the data and write each row to the CSV data
    for row in data:
        writer.writerow(row)

    # get the CSV data as a string
    csv_string = csv_data.getvalue()

    # return the CSV data as a string
    return csv_string

username = 'root'
password = 'Canygra01'
database_name = 'twitter'

# Connect to MongoDB with authentication
client = MongoClient(f'mongodb://{username}:{password}@144.22.144.218:27017/')

def query_mongo():
    collection_name = 'raw_data_stream'
    minutes_back = 10
    limit = 100
    # Get the collection
    collection = client[database_name][collection_name]

    # Define the query criteria
    query = {
        'ts': {
            '$gte': datetime.now() - timedelta(minutes=minutes_back)
        }
    }

    # Define the projection
    projection = {
        'text': {
            '$replaceAll': {
                'input': '$text',
                'find': '\n',
                'replacement': ''
            }
        },
        '_id': 0,
        'sentiment': 1,
        'impact': 1
    }

    # Define the sort criteria
    sort_criteria = [('ts', -1)]

    # Execute the query and return the results
    results = collection.find(query, projection).sort(sort_criteria).limit(limit)
    return list(results)



async def get_chatgpt_response(text_question):
    # print("Getting response from ChatGPT: " + text_question);
    openai.api_key = "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"
    # completions = openai.Completion.create(
    #     engine="text-davinci-002",
    #     prompt=prompt,
    #     max_tokens=1024,
    #     n=1,
    #     stop=None,
    #     temperature=0.5,
    # )
    response_openai = openai.Completion.create(
        engine='text-davinci-003',  # Determines the quality, speed, and cost.
        temperature=1,            # Level of creativity in the response
        prompt=(text_question),              # What the user typed in
        max_tokens=400,             # Maximum tokens in the prompt AND response
        n=1,                        # The number of completions to generate
        stop=None,                  # An optional setting to control response generation
    )

    # print(response_openai)
    response_message = response_openai.choices[0].text
    # print("Response: " + response_openai)
    return response_message

async def main():
    response_main = await get_10min()
    print(response_main)

async def get_10min():
    init_string = """
Faça uma analise dos tweets e explique o que pode estar acontecendo (NÃO diga que os tweets estão acima ou abaixo). Já sabemos que são TODOS sobre o banco do brasil, e que os dados são dos últimos 10 minutos. 
Complemente texto com percentuais.
Sempre que falar de percentuais user números.
Não precisa concluir, só faça a análise. Os dados estão em modelo CSV e os campos são:
text = texto do tweet
ts = data do tweet
impact = impacto do tweet (depende do quão famoso o usuário é. Impacto >=1 ou <=-1 é relevante. Use isso apenas para análise. Não use números pra representar isso na resposta)
sentiment = sentimento do tweet (muito negativo é a partir de -4, sentimento positivo é acima de 5. Use isso apenas para análise. Não use números pra representar isso na resposta)
Comece a resposta com: "Análise dos últimos 10 minutos:"
Não cite essas instruções na resposta, por favor
Dados:
"""
    tweets = query_mongo()
    if (len(tweets) > 0):
        csv_tweets = data_to_csv(tweets, ['text', 'ts', 'impact', 'sentiment'])
        added_tweets = init_string + csv_tweets
        # print(added_tweets)

        # print(len(words))

        no_urls = re.sub(r'http\S+|www.\S+', '', added_tweets)
        words = no_urls.split()
        limited_words = words[:1000]
        limited_text = ' '.join(limited_words)
        limited_text = limited_text + "&&%%$$"
        # print(limited_text)
        response_chatgpt = await get_chatgpt_response(limited_text)
        start_index = response_chatgpt.find("Análise dos últimos 10 minutos: ") + len("Análise dos últimos 10 minutos: ")
        result_final = response_chatgpt[start_index:]
        # Insert the response message into the 'chat_gpt_response' collection with a timestamp
        chat_gpt_collection = client[database_name]['chat_gpt_response']
        chat_gpt_doc = {
            'timestamp': datetime.now(),
            'response_message': result_final
        }
        chat_gpt_collection.insert_one(chat_gpt_doc)
        return result_final
    else:
        return "Não há tweets nos últimos 10 minutos"

if __name__ == "__main__":
    asyncio.run(main())