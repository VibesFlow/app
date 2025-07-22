/**
 * Babel plugin to transform import.meta expressions for Metro/Hermes compatibility
 * Replaces import.meta with a polyfilled object
 */

module.exports = function() {
  return {
    name: 'transform-import-meta',
    visitor: {
      MetaProperty(path) {
        // Check if this is import.meta
        if (path.node.meta.name === 'import' && path.node.property.name === 'meta') {
          // Replace import.meta with our polyfilled object
          path.replaceWithSourceString(`{
            url: (typeof window !== 'undefined' && window.location) ? window.location.href : 'file://localhost/',
            env: (typeof process !== 'undefined' && process.env) ? process.env : {},
            resolve: function(id) { return Promise.resolve(id); }
          }`);
        }
      },
      
      // Also handle member expressions like import.meta.url
      MemberExpression(path) {
        if (
          path.node.object &&
          path.node.object.type === 'MetaProperty' &&
          path.node.object.meta.name === 'import' &&
          path.node.object.property.name === 'meta'
        ) {
          const propertyName = path.node.property.name;
          
          if (propertyName === 'url') {
            path.replaceWithSourceString(`(typeof window !== 'undefined' && window.location) ? window.location.href : 'file://localhost/'`);
          } else if (propertyName === 'env') {
            path.replaceWithSourceString(`(typeof process !== 'undefined' && process.env) ? process.env : {}`);
          } else if (propertyName === 'resolve') {
            path.replaceWithSourceString(`function(id) { return Promise.resolve(id); }`);
          } else {
            // For any other property, return undefined
            path.replaceWithSourceString(`undefined`);
          }
        }
      }
    }
  };
}; 