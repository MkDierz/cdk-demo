import * as cdk from 'aws-cdk-lib';
import { Template } from 'aws-cdk-lib/assertions';
import { CdkDemoStack } from '../lib/cdk-demo-stack';

describe('CdkDemoStack', () => {
  let template: Template;

  beforeAll(() => {
    template = Template.fromStack(new CdkDemoStack(new cdk.App(), 'TestStack'));
  });

  test('AppSync GraphQL API with API key auth', () => {
    template.hasResourceProperties('AWS::AppSync::GraphQLApi', {
      AuthenticationType: 'API_KEY',
    });
    template.resourceCountIs('AWS::AppSync::GraphQLSchema', 1);
    template.resourceCountIs('AWS::AppSync::ApiKey', 1);
  });

  test('all four schema fields have Lambda resolvers', () => {
    template.resourceCountIs('AWS::AppSync::Resolver', 4);
    template.hasResourceProperties('AWS::AppSync::DataSource', {
      Type: 'AWS_LAMBDA',
    });
  });

  test('resolver and seed Lambdas run Node.js 22', () => {
    template.hasResourceProperties('AWS::Lambda::Function', {
      Runtime: 'nodejs22.x',
    });
  });

  test('Aurora Serverless v2 Postgres with Data API enabled', () => {
    template.hasResourceProperties('AWS::RDS::DBCluster', {
      Engine: 'aurora-postgresql',
      EnableHttpEndpoint: true,
      ServerlessV2ScalingConfiguration: {
        MinCapacity: 0.5,
        MaxCapacity: 2,
      },
    });
  });

  test('seed runs as a custom resource keyed on schemaVersion', () => {
    template.hasResourceProperties('Custom::TodoSeed', {
      schemaVersion: '1',
    });
  });

  test('no NAT gateways — keeps demo deploys cheap', () => {
    template.resourceCountIs('AWS::EC2::NatGateway', 0);
  });
});
