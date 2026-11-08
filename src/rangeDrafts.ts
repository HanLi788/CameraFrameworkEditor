// Flush interval edits before saving or switching to source, including keyboard Save.
export async function flushRangeEdits(path?:string){
  const jobs:Promise<unknown>[]=[];
  document.querySelectorAll<HTMLElement>('[data-range-interval]').forEach(el=>{
    if(path&&(el.closest('[role="tabpanel"]')?.getAttribute('aria-label')||el.closest('[data-numeric-document]')?.getAttribute('data-numeric-document'))!==path)return;
    el.dispatchEvent(new CustomEvent('commit-range',{detail:jobs}));
  });
  await Promise.all(jobs);
}
