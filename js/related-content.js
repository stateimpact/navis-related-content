(function($) {
    
    var wrapError = function(onError, model, options) {
        return function(resp) {
            if (onError) {
                onError(model, resp, options);
            } else {
                model.trigger('error', model, resp, options);
            }
        };
    };

    Backbone.sync = function(method, model, options) {
        
        var actions = {
            'create': 'save_related_content',
            'update': 'save_related_content',
            'read'  : 'fetch_related_content'
        };
        
        var data = options.data || {};
        data.action = actions[method];
        if (!data.action) return;
        
        var success = function(data) {
            data = JSON.parse(data);
            if (_.isFunction(options.success)) {
                options.success(data);
            }
        }
        $.ajax({
            url: window.ajaxurl,
            type: 'POST',
            data: data,
            success: success,
            error: options.error
        });
    }
    
    // one link, to a post, topic, or somewhere else
    var Link = Backbone.Model.extend({
        
        initialize: function(attributes, options) {
            this.view = new LinkView({ model: this });
            return this;
        },
        
        defaults: {
            title: "",
            permalink: "",
            type: "post",
            thumbnail: ""
        },
        
        url: window.ajaxurl
    });
    
    // container model for a group of links
    var RelatedContentModule = Backbone.Model.extend({
        
        defaults: {
            title: "",
            links: []
        }
    });
    
    // collections are simple
    // we need two here: links/posts and topics
    window.LinkList = Backbone.Collection.extend({
        model: Link,
        
        url: window.ajaxurl
        
        /***
        fetch: function(options) {
            _.defaults(options, {
                action: "fetch_related_content"
            });
            var model = this;
            var success = options.success;
            options.success = function(resp, status, xhr) {
                if (!model.set(model.parse(resp, xhr), options)) return false;
                if (success) success(model, resp);
            };
            options.error = wrapError(options.error, model, options);
            return (this.sync || Backbone.sync).call(this, 'read', this, options);
        },
        ***/
    });
    
    var LinkView = Backbone.View.extend({
        
        className: 'link',
        
        initialize: function(options) {
            _.bindAll(this);
            return this.render();
        },
        
        render: function() {
            if (this.model.get('thumbnail') && this.model.get('type') === "topic") {
                var img = $('<img/>')
                    .attr('src', this.model.get('thumbnail'))
                    .appendTo( $(this.el) );
            };
            
            var a = $('<a/>')
                .attr('href', this.model.get('permalink'))
                .text(this.model.get('type').toUpperCase() + ": " + this.model.get('title'))
                .appendTo( $(this.el) );
            return this;
        }
    });
    
    // view for a collection of links of any type
    var LinkListView = Backbone.View.extend({
        
        initialize: function(options) {
            _.bindAll(this);
            this.collection.bind('reset', this.render);
            return this;
        },
        
        render: function() {
            var el = this.el;
            $(el).empty();
            this.collection.each(function(link, i, links) {
                $(el).append(link.view.el);
            });
        }
    });
    
    
    // build a related content module
    // tinymce should call this
    window.RelatedContentBuilder = Backbone.View.extend({
        
        el: '#navis-related-content-form',
        
        initialize: function(options) {
            _.extend(this, options);
            _.bindAll(this);
            
            this.search = new LinkListView({
                el: '#related-search-results',
                collection: new LinkList()
            });
            this.search.collection.fetch();
            
            this.links = new LinkListView({
                el: "#chosen-links",
                collection: new LinkList()
            });
            
            this.topics = new LinkListView({
                el: "#chosen-topics",
                collection: new LinkList()
            });
            
            return this;
        },
        
    });
        
})(window.jQuery);