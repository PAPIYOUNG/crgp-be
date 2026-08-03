export const RESOURCE_SERVICE_MAP = {
  EC2: [
    'AWS::EC2::Instance',
    'AWS::EC2::Volume',
    'AWS::EC2::Snapshot',
    'AWS::EC2::Subnet',
    'AWS::EC2::VPC',
    'AWS::EC2::RouteTable',
    'AWS::EC2::SubnetRouteTableAssociation',
    'AWS::EC2::SecurityGroup',
    'AWS::EC2::NetworkAcl',
    'AWS::EC2::InternetGateway',
    'AWS::EC2::NatGateway',
    'AWS::EC2::EIP'
  ],

  RDS: [
    'AWS::RDS::DBInstance',
    'AWS::RDS::DBCluster',
    'AWS::RDS::DBSubnetGroup'
  ],

  S3: ['AWS::S3::Bucket'],

  LAMBDA: ['AWS::Lambda::Function'],

  EKS: ['AWS::EKS::Cluster', 'AWS::EKS::Nodegroup'],

  LOAD_BALANCER: [
    'AWS::ElasticLoadBalancing::LoadBalancer',
    'AWS::ElasticLoadBalancingV2::LoadBalancer'
  ],

  WAF: ['AWS::WAF::WebACL', 'AWS::WAFv2::WebACL'],

  CDN: ['AWS::CloudFront::Distribution'],

  NETWORKING: [
    'AWS::Route53Resolver::ResolverRule',
    'AWS::Route53Resolver::ResolverRuleAssociation'
  ]
} as const;
