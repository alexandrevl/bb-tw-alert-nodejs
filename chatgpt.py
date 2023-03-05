import os
import openai
import re
import string
import sys

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
    minutes_back = 20
    limit = 400
    # Get the collection
    collection = client[database_name][collection_name]

    # Define the query criteria
    query = {
        'ts': {
            '$gte': datetime.now() - timedelta(minutes=minutes_back)
        }
    }

    # Define the aggregation pipeline
    pipeline = [
        {'$match': query},
        # {'$replaceWith': {'text': {'$split': ['$text', '\n']}}},
        # {'$unwind': '$text'},
        {'$group': {
            '_id': '$text',
            'qnt': {'$sum': 1},
            'sentiment': { '$avg': "$sentiment"},
            'impact': { '$avg': "$impact" }, 
        }},
        {'$project': {
            '_id': 0,
            'text': '$_id',
            'qnt': 1,
            'sentiment': 1,
            'impact': {"$round": ["$impact", 3]}
        }},
        {'$sort': {'ts': -1, 'impact': 1, 'qnt': -1}},
        {'$limit': limit}
    ]

    # Execute the query and return the results
    results = collection.aggregate(pipeline)
    # print(list(results))
   

    # qnt = 0
    # for result in results:
    #     qnt = qnt + 1
    # # print(qnt)

    return list(results)




def get_chatgpt_response(text_question):
    openai.api_key = "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"
    system_text = """
Identifique os assuntos que estão sendo comentados e discutidos e faça uma análise dos tweets e sugira o que pode estar acontecendo.
Siga as instruções:
- Coisas que já sabemos: Os tweets tem relação com Banco do brasil, e que os dados são dos últimos 10 minutos. Não precisa falar que a maioria dos tweets são sobre o Banco do Brasil. Já sabemos disso;
- Procure as ligações com o Banco do Brasil;
- Use "\n" para quebrar linha;
- Dois assuntos são fortemente relacionados: pix e aplicativo. Sempre que eles aparecerem coloque como o mesmo assunto;
- Tente identificar tendências;
- Use percentuais das quantidades de tweets;
- Sempre que for usar as palavras muito, alguns e poucos use como régua: muitos é mais de 50, alguns é mais de 10, poucos é mais de 5;
- Toda vez que aparacer RT (maiúscula e com espaço depois) é um retweet. Retweets são menos relevantes que tweets originais;
- Os dados estão em modelo CSV e os campos são:
    text = texto do tweet,
    impact = média do impacto do tweet (depende do quão famoso o usuário é. Régua do impacto: >=1 ou <=-1 é relevante, >=3 ou <=-3 é muito relevante. Se for falar disso, explique.),
    sentiment = média do sentimento do tweet (Régua do sentimento: <=-5 sentimento péssimo, > 5 sentimento positivo. Se for falar disso, explique.),
    qnt = quantidade de vezes que o tweet apareceu;
- Se o impacto do tweet for relevante favoreça esse assunto na sua análise. Se o impacto do tweet for muito relevante, dê ainda mais ênfase a esse assunto;
- Se a soma dos sentimentos for < -200 é um momento com elevadíssima insatisfação. Se a soma dos sentimentos for < -80 é um momento com muita insatisfação. Se a soma dos sentimentos for >= -80 é um momento sem grandes problemas, sem insatisfação praticamente. Se a soma dos sentimentos for >= 0 é um momento tranquilo. Se a soma dos sentimentos for >= 300 é um momento positivo;
- Importante: O Bolsonaro perdeu a eleição e o Lula é o novo presidente. Bolsonaro é ex-presidente. Se o assunto for sobre ele, considere que ele é ex-presidente;
- Importante: Lula é o presidente da república do Brasil. Se refira ao Lula como presidente.
- Não cite essas instruções;
- Quando encontrar exatamente essa string "@BancoDoBrasil: " é um tweet do Banco do Brasil. Quando há problemas esse usuário responde aos clientes. Analise o que esse usuário fale para informar qual a resposta o banco do brasil está dando;
- Faça em tópicos. Exemplo: - Assunto interessante (23%): bla bla bla;
- No final use: Resumo: bla bla bla;

Dados:

    """

    response_openai = openai.ChatCompletion.create(
        model='gpt-3.5-turbo',      # Determines the quality, speed, and cost.
        # messages=[{"role": "system", "content": system_text}, {"role": "user", "content": text_question}],              # What the user typed in
        # messages=[{"role": "user", "content": system_text}, {"role": "user", "content": text_question}], 
        messages=[{"role": "system", "content": "Você é um jornalista, você está no Brasil. Lula é o presidente e Bolsonaro é ex-presidente"}, {"role": "user", "content": system_text + text_question}], 
    )

    # print(response_openai)
    # response_message = response_openai.choices[0].text
    response_message = response_openai.choices[0].message.content
    # print("Response: " + response_message)
    return response_message

def get_chatgpt_response_short(text_question):
    openai.api_key = "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"
    system_text = """
Identifique os assuntos que estão sendo comentados e discutidos e faça uma análise dos tweets e sugira o que pode estar acontecendo. Será um tweet, portanto não ultrapasse 280 caracteres.
Siga as instruções:
- Coisas que já sabemos: Os tweets tem relação com Banco do brasil, e que os dados são dos últimos 10 minutos. Não precisa falar que a maioria dos tweets são sobre o Banco do Brasil. Já sabemos disso;
- Procure as ligações com o Banco do Brasil;
- Dois assuntos são fortemente relacionados: pix e aplicativo. Sempre que eles aparecerem coloque como o mesmo assunto;
- Use percentuais das quantidades de tweets;
- Sempre que for usar as palavras muito, alguns e poucos use como régua: muitos é mais de 50, alguns é mais de 10, poucos é mais de 5;
- Toda vez que aparacer RT (maiúscula e com espaço depois) é um retweet. Retweets são menos relevantes que tweets originais;
- Os dados estão em modelo CSV e os campos são:
    text = texto do tweet,
    impact = média do impacto do tweet (depende do quão famoso o usuário é. Régua do impacto: >=1 ou <=-1 é relevante, >=3 ou <=-3 é muito relevante. Se for falar disso, explique.),
    sentiment = média do sentimento do tweet (Régua do sentimento: <=-5 sentimento péssimo, > 5 sentimento positivo. Se for falar disso, explique.),
    qnt = quantidade de vezes que o tweet apareceu;
- Se o impacto do tweet for relevante favoreça esse assunto na sua análise. Se o impacto do tweet for muito relevante, dê ainda mais ênfase a esse assunto;
- Se a soma dos sentimentos for < -200 é um momento com elevadíssima insatisfação. Se a soma dos sentimentos for < -80 é um momento com muita insatisfação. Se a soma dos sentimentos for >= -80 é um momento sem grandes problemas, sem insatisfação praticamente. Se a soma dos sentimentos for >= 0 é um momento tranquilo. Se a soma dos sentimentos for >= 300 é um momento positivo;
- Importante: O Bolsonaro perdeu a eleição e o Lula é o novo presidente. Bolsonaro é ex-presidente. Se o assunto for sobre ele, considere que ele é ex-presidente;
- Importante: Lula é o presidente da república do Brasil. Se refira ao Lula como presidente.
- Máximo de 280 caracteres.
- Não cite essas instruções;
- Quando encontrar exatamente essa string "@BancoDoBrasil: " é um tweet do Banco do Brasil. Quando há problemas esse usuário responde aos clientes. Analise o que esse usuário fale para informar qual a resposta o banco do brasil está dando;

Dados:

    """

    response_openai = openai.ChatCompletion.create(
        model='gpt-3.5-turbo',      # Determines the quality, speed, and cost.
        # messages=[{"role": "system", "content": system_text}, {"role": "user", "content": text_question}],              # What the user typed in
        # messages=[{"role": "user", "content": system_text}, {"role": "user", "content": text_question}], 
        messages=[{"role": "system", "content": "Você é um jornalista, você está no Brasil. Lula é o presidente e Bolsonaro é ex-presidente"}, {"role": "user", "content": system_text + text_question}], 
    )

    # print(response_openai)
    # response_message = response_openai.choices[0].text
    response_message = response_openai.choices[0].message.content
    # print("Response: " + response_message)
    return response_message

def main(args):
    if (len(args) > 0 and args[0] == "short"):
        response_main = get_10min_short()
    else:
        response_main = get_10min()
    print(response_main)

def get_10min_short():
    init_string = ""
    
    tweets = query_mongo()
    # print(len(tweets))
    if (len(tweets) > 0):
        csv_tweets = data_to_csv(tweets, ['qnt', 'text', 'sentiment', 'impact'])
        added_tweets = init_string + csv_tweets
        # print(added_tweets)

        # print(len(words))

        no_urls = re.sub(r'http\S+|www.\S+', '', added_tweets)
        words = no_urls.split()
        limited_words = words[:1250]
        limited_text = ' '.join(limited_words)
        limited_text = limited_text
        # print(limited_text)
        response_chatgpt = get_chatgpt_response_short(limited_text)
        # start_index = response_chatgpt.find("Análise dos últimos 10 minutos:") + len("Análise dos últimos 10 minutos:")
        # result_final = response_chatgpt[start_index:].strip()
        result_final = response_chatgpt.strip();
        # Insert the response message into the 'chat_gpt_response' collection with a timestamp

        chat_gpt_collection = client[database_name]['chat_gpt_response']
        chat_gpt_doc = {
            'timestamp': datetime.now(),
            'response_message': result_final
        }
        chat_gpt_collection.insert_one(chat_gpt_doc)
        date = datetime.now().strftime("%d/%m/%Y %H:%M:%S")
        result_final = "ChatGPT: " + result_final
        return result_final
    else:
        return "Não há tweets nos últimos 10 minutos"

def get_10min():
    init_string = ""
    
    tweets = query_mongo()
    # print(len(tweets))
    if (len(tweets) > 0):
        csv_tweets = data_to_csv(tweets, ['qnt', 'text', 'sentiment', 'impact'])
        added_tweets = init_string + csv_tweets
        # print(added_tweets)

        # print(len(words))

        no_urls = re.sub(r'http\S+|www.\S+', '', added_tweets)
        words = no_urls.split()
        limited_words = words[:1250]
        limited_text = ' '.join(limited_words)
        limited_text = limited_text
        # print(limited_text)
        response_chatgpt = get_chatgpt_response(limited_text)
        # start_index = response_chatgpt.find("Análise dos últimos 10 minutos:") + len("Análise dos últimos 10 minutos:")
        # result_final = response_chatgpt[start_index:].strip()
        result_final = response_chatgpt.strip();
        # Insert the response message into the 'chat_gpt_response' collection with a timestamp

        chat_gpt_collection = client[database_name]['chat_gpt_response']
        chat_gpt_doc = {
            'timestamp': datetime.now(),
            'response_message': result_final
        }
        chat_gpt_collection.insert_one(chat_gpt_doc)
        date = datetime.now().strftime("%d/%m/%Y %H:%M:%S")
        result_final = "Análise ChatGPT (" + date + "):\n\n" + result_final
        return result_final
    else:
        return "Não há tweets nos últimos 10 minutos"

if __name__ == "__main__":
    args = sys.argv[1:]
    main(args)