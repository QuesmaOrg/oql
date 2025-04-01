import React from 'react';


import { testIds } from '../components/testIds';
import { PluginPage } from '@grafana/runtime';
import { PageLayoutType } from '@grafana/data';
import ObservabilityQueryLanguageComponent from '../components/App/ObservabilityQueryLanguageComponent';

function PageOne() {


  return (
    <PluginPage layout={PageLayoutType.Custom}>
      <div data-testid={testIds.pageOne.container}>
        <ObservabilityQueryLanguageComponent />
      </div>
    </PluginPage>
  );
}

export default PageOne;

