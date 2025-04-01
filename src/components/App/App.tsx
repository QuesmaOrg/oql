import React from 'react';
import { Route, Routes } from 'react-router-dom';
import { AppRootProps } from '@grafana/data';
const PageOne = React.lazy(() => import('../../pages/PageOne'));


function App(props: AppRootProps) {
  return (
    <Routes>
      {/* Default page */}
      <Route path="*" element={<PageOne />} />
    </Routes>
  );
}

export default App;
