import * as cdk from 'aws-cdk-lib';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as rds from 'aws-cdk-lib/aws-rds';
import { Construct } from 'constructs';

export class DemoDatabase extends Construct {
  public readonly cluster: rds.DatabaseCluster;
  public readonly databaseName = 'todos';

  constructor(scope: Construct, id: string) {
    super(scope, id);

    // natGateways: 0 — nothing in this stack needs the internet. The Lambdas
    // reach Aurora through the Data API (HTTPS), so no NAT cost.
    const vpc = new ec2.Vpc(this, 'Vpc', {
      maxAzs: 2,
      natGateways: 0,
      subnetConfiguration: [
        { name: 'public', subnetType: ec2.SubnetType.PUBLIC },
        { name: 'isolated', subnetType: ec2.SubnetType.PRIVATE_ISOLATED },
      ],
    });

    this.cluster = new rds.DatabaseCluster(this, 'Cluster', {
      engine: rds.DatabaseClusterEngine.auroraPostgres({
        version: rds.AuroraPostgresEngineVersion.VER_16_13,
      }),
      writer: rds.ClusterInstance.serverlessV2('writer'),
      serverlessV2MinCapacity: 0.5,
      serverlessV2MaxCapacity: 2,
      vpc,
      vpcSubnets: { subnetType: ec2.SubnetType.PRIVATE_ISOLATED },
      credentials: rds.Credentials.fromGeneratedSecret('appadmin'),
      defaultDatabaseName: this.databaseName,
      // Demo repo: `cdk destroy` removes everything.
      // Use RETAIN (the CDK default) in real projects.
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    // The Data API lets clients run SQL over HTTPS without attaching to the
    // VPC. Not exposed on the L2 Cluster props — set it on the Cfn resource.
    const cfnCluster = this.cluster.node.defaultChild as rds.CfnDBCluster;
    cfnCluster.enableHttpEndpoint = true;
  }
}

/** Environment variables every Lambda needs to talk to the cluster. */
export function dbEnvironment(cluster: rds.DatabaseCluster, databaseName: string): Record<string, string> {
  if (!cluster.secret) {
    throw new Error('Cluster must have a generated credentials secret');
  }
  return {
    DB_HOST: cluster.clusterEndpoint.hostname,
    DB_PORT: cluster.clusterEndpoint.port?.toString() ?? '5432',
    DB_USER: 'appadmin',
    DB_PASSWORD: cluster.secret.secretValueFromJson('password').toString(),
    DB_NAME: databaseName,
  };
}
