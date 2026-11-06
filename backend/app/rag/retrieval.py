import re, math
from collections import Counter
def words(text): return re.findall(r'[a-z]{3,}',text.lower())
def chunks(text,size=900):
    return [text[i:i+size] for i in range(0,len(text),size-120) if text[i:i+size].strip()]
def retrieve(query,documents,limit=4):
    q=Counter(words(query)); results=[]
    for doc in documents:
        for idx,chunk in enumerate(doc.get('chunks',[])):
            counts=Counter(words(chunk['text']))
            dot=sum(q[w]*counts[w] for w in q)
            norm=math.sqrt(sum(v*v for v in q.values())*sum(v*v for v in counts.values()))
            score=dot/norm if norm else 0
            if score>0.04: results.append({'document_id':doc['id'],'title':doc['title'],'passage':chunk['text'],'page':chunk.get('page'),'source':doc.get('source','Uploaded material; clinical validity unverified'),'relevance':round(score,3),'synthetic':doc.get('synthetic',False)})
    return sorted(results,key=lambda x:x['relevance'],reverse=True)[:limit]
