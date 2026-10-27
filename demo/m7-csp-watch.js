// Demo helper for m7-script.html (an external file, as the CSP forbids inline scripts).
(function () {
  var count = 0;
  var seen = [];
  document.addEventListener('securitypolicyviolation', function (e) {
    count++;
    seen.push(e.violatedDirective + ' ← ' + (e.sourceFile || e.blockedURI || 'inline'));
    var el = document.getElementById('violations');
    if (el) { el.textContent = String(count); document.getElementById('details').textContent = seen.join(' | '); }
  });
  document.addEventListener('sidekick:ready', function () {
    document.getElementById('global').textContent = typeof window.Sidekick;
    setInterval(function () {
      var pet = window.Sidekick.get();
      document.getElementById('petStatus').textContent = pet ? pet.debug().status + ' (' + pet.debug().pet + ')' : 'none';
    }, 300);
  });
  window.addEventListener('DOMContentLoaded', function () {
    document.getElementById('emit').addEventListener('click', function () { window.Sidekick.get().emit('success'); });
  });
})();
