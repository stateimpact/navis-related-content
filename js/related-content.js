(function($) {
    
    var Link = Backbone.Model.extend({
        
        defaults: {
            title: "",
            url: "",
            type: "post",
            thumbnail: ""
        }
    });
    
    // collections are simple
    // we need two here: links/posts and topics
    var LinkList = Backbone.Collection.extend({
        model: Link
    });
    
    var LinkView = Backbone.View.extend({
        
        tagName: 'link',
        
        initialize: function(options) {
            _.bindAll(this);
            this.model.view = this;
            
            return this;
        },
        
        render: function() {
            if (this.model.thumbnail && this.model.get('type') === "topic") {
                var img = $('<img/>')
                    .attr('src', this.model.thumbnail)
                    .appendTo( $(this.el) );
            }
            
            var a = $('<a/>')
                .attr('href', this.model.url)
                .text(this.model.title)
                .appendTo( $(this.el) );
            return this;
        }
    })
    
    window.navis_related = {
        
        fetch: function(args) {
            var data = $.extend({
                action: 'fetch_related_content',
                pagenum: 1,
                s: ""
            }, args);
            
        }

    };
    // callback to save module data
    
})(window.jQuery);