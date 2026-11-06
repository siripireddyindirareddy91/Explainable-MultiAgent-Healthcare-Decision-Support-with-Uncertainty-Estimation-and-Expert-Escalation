WEIGHTS={'data_completeness':.20,'evidence_quality':.25,'agent_agreement':.20,'calibration_quality':.20,'input_reliability':.15}
def assess(patient,evidence,contradictions,observations):
    fields=['symptoms','history','medications','allergies','duration']
    missing=[f for f in fields if not str(patient.get(f,'')).strip()]
    vitals=patient.get('vitals',{})
    missing += [f for f in ['heart_rate','systolic','spo2','temperature'] if vitals.get(f) is None]
    reliability=0 if not 0<int(patient.get('age',0))<121 else 85
    quality={'data_completeness':round(100*(9-len(missing))/9),'evidence_quality':min(80,len(evidence)*30),'agent_agreement':max(0,100-35*len(contradictions)),'calibration_quality':0,'input_reliability':reliability}
    contributions={k:round((100-v)*WEIGHTS[k],2) for k,v in quality.items()}
    score=round(sum(contributions.values()))
    reasons=[]
    if missing: reasons.append('Missing information: '+', '.join(missing))
    if not evidence: reasons.append('No supporting passage was retrieved from the knowledge base.')
    if contradictions: reasons.append('Conflicting structured observations require review.')
    reasons.append('Calibration is unavailable: deterministic rules have not been clinically validated.')
    return {'uncertainty_score':score,'uncertainty_category':'LOWER' if score<=25 else 'MODERATE' if score<=50 else 'HIGH' if score<=75 else 'VERY HIGH',**quality,'weights':WEIGHTS,'contributions':contributions,'missing':missing,'reasons':reasons,'requires_expert_review':score>50,'method':'Weighted heuristic deficits; not a calibrated clinical probability.'}
