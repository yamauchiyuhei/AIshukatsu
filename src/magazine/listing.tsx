import { createRoot, hydrateRoot } from 'react-dom/client';
import './entry.css';
import './magazine.css';

// Fetch the search catalog after the lightweight entry, so its large module
// does not compete with the initial editorial image in the HTML preload queue.
// Query-filtered results differ from the static default listing and must mount fresh.
const root = document.getElementById('root');
if (root) {
  root.dataset.catalogState = 'loading';
  void import('./MagazineApp').then(({ MagazineApp }) => {
    delete root.dataset.catalogState;
    if (root.querySelector('.mag-index') && !window.location.search) {
      hydrateRoot(root, <MagazineApp />);
    } else {
      createRoot(root).render(<MagazineApp />);
    }
  }, () => {
    root.dataset.catalogState = 'error';
  });
}
