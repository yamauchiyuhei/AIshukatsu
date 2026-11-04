import { createRoot, hydrateRoot } from 'react-dom/client';
import { MagazineApp } from './MagazineApp';
import './entry.css';
import './magazine.css';

// Load the search catalog directly without the landing page or desktop bootstrap.
// Query-filtered results differ from the static default listing and must mount fresh.
const root = document.getElementById('root');
if (root) {
  if (root.querySelector('.mag-index') && !window.location.search) {
    hydrateRoot(root, <MagazineApp />);
  } else {
    createRoot(root).render(<MagazineApp />);
  }
}
