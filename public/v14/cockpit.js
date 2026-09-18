import {copy,esc,status} from './core.js';

const age=m=>{m=Number(m)||0;if(m<60)return copy(`${m} мин`,`${m} min`);const h=Math.floor(m/60);if(h<48)return copy(`${h} ч`,`${h} h`);const d=Math.floor(h/24);return copy(`${d} д`,`${d} d`)};
const label={
  PUBLICATION:['Публикация','Publication'],VERIFICATION:['KYC / KYB','KYC / KYB'],DISPUTE:['Спор','Dispute'],PAYOUT:['Выплата','Payout'],
  SETTLEMENT:['Расчёт','Settlement'],SHIPMENT:['Доставка','Shipment'],OUTBOX:['Системная очередь','System outbox'],PROVIDER_EVENT:['Событие провайдера','Provider event'],MEDIA:['Медиа','Media']
};
const action={
  REVIEW_CATALOGUE:['Проверить каталог','Review catalogue'],PUBLISH:['Опубликовать','Publish'],CLEAR_PUBLICATION_BLOCKERS:['Снять блокировки публикации','Clear publication blockers'],
  REVIEW_VERIFICATION:['Проверить верификацию','Review verification'],AWAIT_CLIENT_INFORMATION:['Ожидать данные клиента','Await client information'],REVIEW_AND_RESOLVE:['Разобрать и решить спор','Review and resolve'],
  AWAIT_EVIDENCE:['Ожидать доказательства','Await evidence'],RETRY_PAYOUT:['Повторить выплату','Retry payout'],SUBMIT_PAYOUT:['Отправить выплату','Submit payout'],
  CHECK_PROVIDER_CONFIRMATION:['Проверить подтверждение провайдера','Check provider confirmation'],REVIEW_HOLD_RELEASE:['Проверить снятие hold','Review hold release'],
  REOFFER_OR_VOID:['Перевыставить или закрыть','Reoffer or void'],CHECK_PAYMENT_PROVIDER:['Проверить PSP','Check PSP'],OPEN_OR_REVIEW_DISPUTE:['Открыть/проверить спор','Open/review dispute'],
  RECOVER_DELIVERY:['Восстановить доставку','Recover delivery'],REVIEW_DEAD_EVENT:['Разобрать DEAD event','Review DEAD event'],RECOVER_STALE_LEASE:['Восстановить lease','Recover stale lease'],
  CHECK_WORKER_BACKLOG:['Проверить backlog worker','Check worker backlog'],RETRY_PROVIDER_EVENT:['Повторить provider event','Retry provider event'],RECOVER_PROVIDER_CLAIM:['Восстановить provider claim','Recover provider claim'],
  CHECK_PROVIDER_EVENT:['Проверить provider event','Check provider event'],RECOVER_MEDIA_VERIFICATION:['Восстановить проверку media','Recover media verification']
};
const tr=x=>copy(...(label[x]||[status(x),status(x)]));
const ta=x=>copy(...(action[x]||[status(x),status(x)]));
function metric(value,title,sub,kind=''){return `<div class="v16-cockpit-metric ${kind}"><strong>${esc(value)}</strong><span>${esc(title)}</span><small>${esc(sub||'')}</small></div>`}
function queueRow(x){return `<article class="v16-cockpit-row sev-${esc(String(x.severity||'INFO').toLowerCase())}">
  <div class="v16-cockpit-row-main"><span class="v16-cockpit-kind">${esc(tr(x.kind))}</span><h4>${esc(ta(x.nextAction))}</h4><p>${esc(x.reason||'')}</p></div>
  <div class="v16-cockpit-row-meta"><b>${esc(x.severity)}</b><span>${esc(x.ownerRole||'—')}</span><span>${esc(age(x.ageMinutes))}</span><code>${esc(x.entityId||'—')}</code></div>
</article>`}
function lifecycleRow(x){return `<div class="v16-life-row"><b>${esc(x.domain)}</b><span>${esc(status(x.from))} → ${esc(status(x.to))}</span><small>${esc(x.authority)} · ${esc(x.action)}</small></div>`}
export function cockpitPanel(d){
  const c=d.cockpit;if(!c)return'';
  const s=c.summary||{},sys=c.system||{},recent=c.recentLifecycle||[],queues=c.queues||[];
  return `<section id="v16Cockpit" class="v16-cockpit" aria-label="${copy('Операторский кокпит','Operator cockpit')}">
    <div class="v16-cockpit-head"><div><div class="eyebrow">OPERATOR COCKPIT · v0.16</div><h3>${copy('Что требует решения сейчас','What requires action now')}</h3></div><div class="v16-cockpit-health">${c.persistence?.durable?'POSTGRESQL · DURABLE':'PREVIEW · NON-DURABLE'}</div></div>
    <div class="v16-cockpit-metrics">
      ${metric(s.actionable||0,copy('Требует действия','Actionable'),copy('По всем контурам','Across all domains'))}
      ${metric(s.critical||0,copy('Критично','Critical'),copy('Нужна немедленная проверка','Immediate review'),'critical')}
      ${metric(s.high||0,copy('Высокий приоритет','High priority'),copy('Бизнес / клиентский риск','Business / client risk'),'high')}
      ${metric(s.systemIncidents||0,copy('Системные инциденты','System incidents'),copy('Outbox / provider / media','Outbox / provider / media'),'system')}
    </div>
    <div class="v16-cockpit-grid">
      <div class="v16-cockpit-queue"><div class="v16-cockpit-section-head"><h4>${copy('Очередь решений','Decision queue')}</h4><span>${queues.length}</span></div>
        ${queues.length?queues.map(queueRow).join(''):`<div class="v16-cockpit-empty">${copy('Активных исключений нет','No active exceptions')}</div>`}
      </div>
      <aside class="v16-cockpit-side">
        <div class="v16-cockpit-sidebox"><div class="v16-cockpit-section-head"><h4>System</h4></div>
          <dl><div><dt>Outbox DEAD</dt><dd>${esc(sys.outbox?.DEAD||0)}</dd></div><div><dt>Provider pending</dt><dd>${esc(sys.unprocessedProviderEvents||0)}</dd></div><div><dt>Media stale</dt><dd>${esc(sys.staleMediaVerifications||0)}</dd></div></dl>
        </div>
        <div class="v16-cockpit-sidebox"><div class="v16-cockpit-section-head"><h4>${copy('Последние переходы','Recent lifecycle')}</h4></div>
          <div class="v16-life-list">${recent.slice(0,8).map(lifecycleRow).join('')||`<small>${copy('Переходов пока нет','No lifecycle transitions yet')}</small>`}</div>
        </div>
      </aside>
    </div>
  </section>`;
}
