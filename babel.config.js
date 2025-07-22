module.exports = function(api) {
  api.cache(true);
  return {
    presets: ['babel-preset-expo'],
    plugins: [
      ['module:react-native-dotenv', {
        moduleName: '@env',
        path: '.env',
        safe: false,
        allowUndefined: true,
      }],
      '@babel/plugin-syntax-import-meta',
      '@babel/plugin-transform-modules-commonjs',
      ['@babel/plugin-transform-react-jsx', {
        runtime: 'automatic',
      }],
      // Custom plugin to transform import.meta for Hermes compatibility
      function({ types: t }) {
        return {
          name: 'transform-import-meta',
          visitor: {
            MetaProperty(path) {
              if (
                path.node.meta.name === 'import' &&
                path.node.property.name === 'meta'
              ) {
                // Replace import.meta with an object expression
                path.replaceWith(
                  t.objectExpression([
                    t.objectProperty(
                      t.identifier('url'),
                      t.conditionalExpression(
                        t.logicalExpression(
                          '&&',
                          t.binaryExpression(
                            '!==',
                            t.unaryExpression('typeof', t.identifier('window')),
                            t.stringLiteral('undefined')
                          ),
                          t.memberExpression(t.identifier('window'), t.identifier('location'))
                        ),
                        t.memberExpression(
                          t.memberExpression(t.identifier('window'), t.identifier('location')),
                          t.identifier('href')
                        ),
                        t.stringLiteral('file://localhost/')
                      )
                    ),
                    t.objectProperty(
                      t.identifier('env'),
                      t.conditionalExpression(
                        t.logicalExpression(
                          '&&',
                          t.binaryExpression(
                            '!==',
                            t.unaryExpression('typeof', t.identifier('process')),
                            t.stringLiteral('undefined')
                          ),
                          t.memberExpression(t.identifier('process'), t.identifier('env'))
                        ),
                        t.memberExpression(t.identifier('process'), t.identifier('env')),
                        t.objectExpression([])
                      )
                    ),
                    t.objectProperty(
                      t.identifier('resolve'),
                      t.functionExpression(
                        null,
                        [t.identifier('id')],
                        t.blockStatement([
                          t.returnStatement(
                            t.callExpression(
                              t.memberExpression(t.identifier('Promise'), t.identifier('resolve')),
                              [t.identifier('id')]
                            )
                          )
                        ])
                      )
                    )
                  ])
                );
              }
            },
            MemberExpression(path) {
              if (
                path.node.object &&
                path.node.object.type === 'MetaProperty' &&
                path.node.object.meta.name === 'import' &&
                path.node.object.property.name === 'meta'
              ) {
                const propertyName = path.node.property.name;
                
                if (propertyName === 'url') {
                  path.replaceWith(
                    t.conditionalExpression(
                      t.logicalExpression(
                        '&&',
                        t.binaryExpression(
                          '!==',
                          t.unaryExpression('typeof', t.identifier('window')),
                          t.stringLiteral('undefined')
                        ),
                        t.memberExpression(t.identifier('window'), t.identifier('location'))
                      ),
                      t.memberExpression(
                        t.memberExpression(t.identifier('window'), t.identifier('location')),
                        t.identifier('href')
                      ),
                      t.stringLiteral('file://localhost/')
                    )
                  );
                } else if (propertyName === 'env') {
                  path.replaceWith(
                    t.conditionalExpression(
                      t.logicalExpression(
                        '&&',
                        t.binaryExpression(
                          '!==',
                          t.unaryExpression('typeof', t.identifier('process')),
                          t.stringLiteral('undefined')
                        ),
                        t.memberExpression(t.identifier('process'), t.identifier('env'))
                      ),
                      t.memberExpression(t.identifier('process'), t.identifier('env')),
                      t.objectExpression([])
                    )
                  );
                } else if (propertyName === 'resolve') {
                  path.replaceWith(
                    t.functionExpression(
                      null,
                      [t.identifier('id')],
                      t.blockStatement([
                        t.returnStatement(
                          t.callExpression(
                            t.memberExpression(t.identifier('Promise'), t.identifier('resolve')),
                            [t.identifier('id')]
                          )
                        )
                      ])
                    )
                  );
                }
              }
            }
          }
        };
      },
    ],
  };
};